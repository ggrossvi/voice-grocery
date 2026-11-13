/**
 * Google Sign-In, Kroger Account Linking & Cart Reminder Engine
 *
 * Uses Google Sign-In ID (`sub`) as the primary `User.id` alongside `email`
 * so the app can link the user's Kroger OAuth account and remind them when
 * items are sitting in their cart.
 *
 * Smart Switch:
 * - Queries Neon Postgres via Prisma when DATABASE_URL is configured.
 * - Falls back to local `data/users.json` & `data/cart_items.json` when DATABASE_URL is unset.
 */

import fs from 'fs';
import path from 'path';
import { APP_CONFIG } from './config';
import { getPrismaClient } from './prisma';
import { refreshKrogerToken } from './kroger';
import { CartItem, CartReminderSummary, FavoriteItem, KrogerProduct, UserProfile } from './types';
import { isFavoriteItem, readLocalFavorites, writeLocalFavorites } from './favorites';

export const USER_SESSION_COOKIE = 'vg_user_id';
export const KROGER_TOKEN_COOKIE = 'kroger_token';

const USERS_FILE_PATH = path.join(process.cwd(), 'data', 'users.json');
const CART_ITEMS_FILE_PATH = path.join(process.cwd(), 'data', 'cart_items.json');

interface StoredUserRecord {
  id: string; // Google `sub` ID
  email: string;
  name?: string;
  image?: string;
  preferredStoreId?: string;
  preferredStoreName?: string;
  preferredStoreChain?: string;
  krogerProfileId?: string;
  krogerAccessToken?: string;
  krogerRefreshToken?: string;
  krogerTokenExpiresAt?: string;
  krogerConnectedAt?: string;
  lastCartActivityAt?: string;
  lastCartRemindedAt?: string;
  cartRemindersEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredCartItemRecord {
  id: string;
  userId: string;
  krogerUpc: string;
  title: string;
  brand?: string;
  size?: string;
  price?: number;
  imageUrl?: string;
  quantity: number;
  modality: string;
  addedAt: string;
  remindedAt?: string;
  checkedOut: boolean;
}

function ensureLocalAuthFiles(): void {
  const dir = path.dirname(USERS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE_PATH)) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(CART_ITEMS_FILE_PATH)) {
    fs.writeFileSync(CART_ITEMS_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readLocalUsers(): StoredUserRecord[] {
  try {
    ensureLocalAuthFiles();
    return JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLocalUsers(users: StoredUserRecord[]): void {
  ensureLocalAuthFiles();
  fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

function readLocalCartItems(): StoredCartItemRecord[] {
  try {
    ensureLocalAuthFiles();
    return JSON.parse(fs.readFileSync(CART_ITEMS_FILE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLocalCartItems(items: StoredCartItemRecord[]): void {
  ensureLocalAuthFiles();
  fs.writeFileSync(CART_ITEMS_FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

function toUserProfile(record: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  preferredStoreId?: string | null;
  preferredStoreName?: string | null;
  preferredStoreChain?: string | null;
  krogerAccessToken?: string | null;
  krogerRefreshToken?: string | null;
  krogerConnectedAt?: Date | string | null;
  cartRemindersEnabled: boolean;
  lastCartActivityAt?: Date | string | null;
  lastCartRemindedAt?: Date | string | null;
}): UserProfile {
  const toIso = (val?: Date | string | null) =>
    val instanceof Date ? val.toISOString() : val ?? undefined;

  return {
    id: record.id,
    email: record.email,
    name: record.name ?? undefined,
    image: record.image ?? undefined,
    preferredStoreId: record.preferredStoreId ?? undefined,
    preferredStoreName: record.preferredStoreName ?? undefined,
    preferredStoreChain: record.preferredStoreChain ?? undefined,
    krogerConnected: Boolean(record.krogerAccessToken || record.krogerRefreshToken),
    krogerConnectedAt: toIso(record.krogerConnectedAt),
    cartRemindersEnabled: record.cartRemindersEnabled,
    lastCartActivityAt: toIso(record.lastCartActivityAt),
    lastCartRemindedAt: toIso(record.lastCartRemindedAt),
  };
}

/**
 * Builds the Google OAuth 2.0 authorization URL.
 */
export function getGoogleAuthorizationUrl(state: string = 'google_signin'): string {
  const params = new URLSearchParams({
    client_id: APP_CONFIG.google.clientId,
    redirect_uri: APP_CONFIG.google.redirectUri,
    response_type: 'code',
    scope: APP_CONFIG.google.scopes,
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });
  return `${APP_CONFIG.google.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchanges a Google OAuth 2.0 authorization code for the user's Google profile (`sub`, `email`, `name`, `picture`).
 */
export async function exchangeGoogleCodeForProfile(code: string): Promise<{
  googleId: string;
  email: string;
  name?: string;
  image?: string;
}> {
  const tokenRes = await fetch(APP_CONFIG.google.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: APP_CONFIG.google.clientId,
      client_secret: APP_CONFIG.google.clientSecret,
      redirect_uri: APP_CONFIG.google.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  const userRes = await fetch(APP_CONFIG.google.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    const errText = await userRes.text();
    throw new Error(`Failed to fetch Google user profile (${userRes.status}): ${errText}`);
  }

  const profile = await userRes.json();
  if (!profile.sub || !profile.email) {
    throw new Error('Google profile did not include required sub ID and email');
  }

  return {
    googleId: String(profile.sub),
    email: String(profile.email),
    name: profile.name ? String(profile.name) : undefined,
    image: profile.picture ? String(profile.picture) : undefined,
  };
}

/**
 * Creates or updates a User record using their Google Sign-In ID (`id`) and `email`.
 */
export async function upsertGoogleUser(input: {
  googleId: string;
  email: string;
  name?: string;
  image?: string;
}): Promise<UserProfile> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const user = await prisma.user.upsert({
        where: { id: input.googleId },
        update: {
          email: input.email,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.image !== undefined ? { image: input.image } : {}),
        },
        create: {
          id: input.googleId,
          email: input.email,
          name: input.name ?? null,
          image: input.image ?? null,
        },
      });
      return toUserProfile(user);
    } catch (error) {
      console.error('Prisma error upserting Google user, falling back to local storage:', error);
    }
  }

  const users = readLocalUsers();
  const now = new Date().toISOString();
  const idx = users.findIndex(u => u.id === input.googleId || u.email === input.email);

  if (idx >= 0) {
    users[idx] = {
      ...users[idx],
      id: input.googleId,
      email: input.email,
      name: input.name ?? users[idx].name,
      image: input.image ?? users[idx].image,
      updatedAt: now,
    };
    writeLocalUsers(users);
    return toUserProfile(users[idx]);
  }

  const newUser: StoredUserRecord = {
    id: input.googleId,
    email: input.email,
    name: input.name,
    image: input.image,
    preferredStoreId: '70500872',
    cartRemindersEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
  users.push(newUser);
  writeLocalUsers(users);
  return toUserProfile(newUser);
}

/**
 * Retrieves a user profile by their Google Sign-In ID.
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return user ? toUserProfile(user) : null;
    } catch (error) {
      console.error('Prisma error reading user, falling back to local storage:', error);
    }
  }

  const users = readLocalUsers();
  const found = users.find(u => u.id === userId);
  return found ? toUserProfile(found) : null;
}

/**
 * Updates a signed-in user's preferred Home Store in Neon Postgres.
 */
export async function updateUserPreferredStore(
  userId: string,
  store: {
    locationId: string;
    name?: string;
    chain?: string;
  }
): Promise<UserProfile | null> {
  if (!userId || !store.locationId) return null;

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          preferredStoreId: store.locationId,
          ...(store.name !== undefined ? { preferredStoreName: store.name } : {}),
          ...(store.chain !== undefined ? { preferredStoreChain: store.chain } : {}),
        },
      });
      return toUserProfile(updated);
    } catch (error) {
      console.error('Prisma error updating preferred store, falling back to local storage:', error);
    }
  }

  const users = readLocalUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) return null;

  users[idx] = {
    ...users[idx],
    preferredStoreId: store.locationId,
    preferredStoreName: store.name ?? users[idx].preferredStoreName,
    preferredStoreChain: store.chain ?? users[idx].preferredStoreChain,
    updatedAt: new Date().toISOString(),
  };
  writeLocalUsers(users);
  return toUserProfile(users[idx]);
}

/**
 * Links a Kroger OAuth account (access & refresh tokens) to a signed-in Google User.
 */
export async function linkKrogerAccountToUser(
  userId: string,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    krogerProfileId?: string;
  }
): Promise<UserProfile | null> {
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  const connectedAt = new Date();

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          krogerAccessToken: tokens.accessToken,
          ...(tokens.refreshToken ? { krogerRefreshToken: tokens.refreshToken } : {}),
          krogerTokenExpiresAt: expiresAt,
          krogerConnectedAt: connectedAt,
          ...(tokens.krogerProfileId ? { krogerProfileId: tokens.krogerProfileId } : {}),
        },
      });
      return toUserProfile(updated);
    } catch (error) {
      console.error('Prisma error linking Kroger account, falling back to local storage:', error);
    }
  }

  const users = readLocalUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) return null;

  users[idx] = {
    ...users[idx],
    krogerAccessToken: tokens.accessToken,
    krogerRefreshToken: tokens.refreshToken ?? users[idx].krogerRefreshToken,
    krogerTokenExpiresAt: expiresAt.toISOString(),
    krogerConnectedAt: connectedAt.toISOString(),
    krogerProfileId: tokens.krogerProfileId ?? users[idx].krogerProfileId,
    updatedAt: connectedAt.toISOString(),
  };
  writeLocalUsers(users);
  return toUserProfile(users[idx]);
}

/**
 * Resolves a valid Kroger customer access token for a signed-in Google user,
 * refreshing it automatically if expired.
 */
export async function getValidKrogerTokenForUser(userId?: string): Promise<string | undefined> {
  if (!userId) return undefined;

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  let expiresAt: Date | undefined;

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        accessToken = user.krogerAccessToken ?? undefined;
        refreshToken = user.krogerRefreshToken ?? undefined;
        expiresAt = user.krogerTokenExpiresAt ?? undefined;
      }
    } catch (error) {
      console.error('Prisma error getting Kroger token, falling back to local storage:', error);
    }
  }

  if (!accessToken) {
    const users = readLocalUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      accessToken = user.krogerAccessToken;
      refreshToken = user.krogerRefreshToken;
      expiresAt = user.krogerTokenExpiresAt ? new Date(user.krogerTokenExpiresAt) : undefined;
    }
  }

  if (!accessToken) return undefined;

  // If token is still valid (with 60s buffer), return it directly
  if (!expiresAt || expiresAt.getTime() > Date.now() + 60_000) {
    return accessToken;
  }

  // Attempt automatic refresh if refresh token is available and not a sandbox token
  if (refreshToken && !refreshToken.startsWith('sandbox_') && APP_CONFIG.kroger.isConfigured()) {
    try {
      const refreshed = await refreshKrogerToken(refreshToken);
      await linkKrogerAccountToUser(userId, refreshed);
      return refreshed.accessToken;
    } catch (error) {
      console.warn('Failed to refresh Kroger token for user:', error);
    }
  }

  return accessToken;
}

/**
 * Records an item added to the user's Kroger cart so we can remind them later via their Google email.
 */
export async function recordUserCartItem(
  userId: string,
  item: KrogerProduct | FavoriteItem,
  quantity: number = 1,
  modality: 'PICKUP' | 'DELIVERY' = 'PICKUP'
): Promise<CartItem> {
  const upc = isFavoriteItem(item) ? item.krogerUpc : item.upc;
  const title = isFavoriteItem(item) ? item.title : item.description;
  const price = isFavoriteItem(item) ? item.lastPrice : item.price;
  const now = new Date();

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const created = await prisma.cartItem.create({
        data: {
          userId,
          krogerUpc: upc,
          title,
          brand: item.brand ?? null,
          size: item.size ?? null,
          price: price ?? null,
          imageUrl: item.imageUrl ?? null,
          quantity,
          modality,
          addedAt: now,
          checkedOut: false,
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { lastCartActivityAt: now },
      });

      return {
        id: created.id,
        upc: created.krogerUpc,
        title: created.title,
        brand: created.brand ?? undefined,
        size: created.size ?? undefined,
        price: created.price ?? undefined,
        imageUrl: created.imageUrl ?? undefined,
        quantity: created.quantity,
        addedAt: created.addedAt.toISOString(),
      };
    } catch (error) {
      console.error('Prisma error recording user cart item, falling back to local storage:', error);
    }
  }

  const cartItems = readLocalCartItems();
  const newCartRecord: StoredCartItemRecord = {
    id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    krogerUpc: upc,
    title,
    brand: item.brand,
    size: item.size,
    price,
    imageUrl: item.imageUrl,
    quantity,
    modality,
    addedAt: now.toISOString(),
    checkedOut: false,
  };
  cartItems.unshift(newCartRecord);
  writeLocalCartItems(cartItems);

  const users = readLocalUsers();
  const uIdx = users.findIndex(u => u.id === userId);
  if (uIdx >= 0) {
    users[uIdx].lastCartActivityAt = now.toISOString();
    users[uIdx].updatedAt = now.toISOString();
    writeLocalUsers(users);
  }

  return {
    id: newCartRecord.id,
    upc: newCartRecord.krogerUpc,
    title: newCartRecord.title,
    brand: newCartRecord.brand,
    size: newCartRecord.size,
    price: newCartRecord.price,
    imageUrl: newCartRecord.imageUrl,
    quantity: newCartRecord.quantity,
    addedAt: newCartRecord.addedAt,
  };
}

/**
 * Returns all active (unchecked-out) cart items for a specific Google user ID.
 */
export async function getUserActiveCartItems(userId: string): Promise<CartItem[]> {
  if (!userId) return [];

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.cartItem.findMany({
        where: { userId, checkedOut: false },
        orderBy: { addedAt: 'desc' },
      });
      return rows.map(r => ({
        id: r.id,
        upc: r.krogerUpc,
        title: r.title,
        brand: r.brand ?? undefined,
        size: r.size ?? undefined,
        price: r.price ?? undefined,
        imageUrl: r.imageUrl ?? undefined,
        quantity: r.quantity,
        addedAt: r.addedAt.toISOString(),
      }));
    } catch (error) {
      console.error('Prisma error reading active cart items, falling back to local storage:', error);
    }
  }

  const cartItems = readLocalCartItems();
  return cartItems
    .filter(c => c.userId === userId && !c.checkedOut)
    .map(c => ({
      id: c.id,
      upc: c.krogerUpc,
      title: c.title,
      brand: c.brand,
      size: c.size,
      price: c.price,
      imageUrl: c.imageUrl,
      quantity: c.quantity,
      addedAt: c.addedAt,
    }));
}

/**
 * Finds users (by Google `id` and `email`) who have items waiting in their cart
 * and builds a reminder summary for each user.
 */
export async function getUsersNeedingCartReminders(): Promise<CartReminderSummary[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const usersWithCart = await prisma.user.findMany({
        where: {
          cartRemindersEnabled: true,
          cartItems: {
            some: { checkedOut: false },
          },
        },
        include: {
          cartItems: {
            where: { checkedOut: false },
            orderBy: { addedAt: 'desc' },
          },
        },
      });

      return usersWithCart.map(u => {
        const items: CartItem[] = u.cartItems.map(c => ({
          id: c.id,
          upc: c.krogerUpc,
          title: c.title,
          brand: c.brand ?? undefined,
          size: c.size ?? undefined,
          price: c.price ?? undefined,
          imageUrl: c.imageUrl ?? undefined,
          quantity: c.quantity,
          addedAt: c.addedAt.toISOString(),
        }));
        const previewNames = items.slice(0, 3).map(i => i.title).join(', ');
        return {
          userId: u.id,
          email: u.email,
          name: u.name ?? undefined,
          itemCount: items.length,
          items,
          lastCartActivityAt: u.lastCartActivityAt?.toISOString(),
          reminderMessage: `Hi ${u.name || u.email}, you have ${items.length} item(s) waiting in your Kroger cart (${previewNames}). Don't forget to check out!`,
        };
      });
    } catch (error) {
      console.error('Prisma error querying cart reminders, falling back to local storage:', error);
    }
  }

  const users = readLocalUsers();
  const cartItems = readLocalCartItems();
  const summaries: CartReminderSummary[] = [];

  for (const u of users) {
    if (!u.cartRemindersEnabled) continue;
    const active = cartItems.filter(c => c.userId === u.id && !c.checkedOut);
    if (active.length === 0) continue;

    const items: CartItem[] = active.map(c => ({
      id: c.id,
      upc: c.krogerUpc,
      title: c.title,
      brand: c.brand,
      size: c.size,
      price: c.price,
      imageUrl: c.imageUrl,
      quantity: c.quantity,
      addedAt: c.addedAt,
    }));
    const previewNames = items.slice(0, 3).map(i => i.title).join(', ');
    summaries.push({
      userId: u.id,
      email: u.email,
      name: u.name,
      itemCount: items.length,
      items,
      lastCartActivityAt: u.lastCartActivityAt,
      reminderMessage: `Hi ${u.name || u.email}, you have ${items.length} item(s) waiting in your Kroger cart (${previewNames}). Don't forget to check out!`,
    });
  }

  return summaries;
}

/**
 * Records that a cart reminder was sent to a user (by Google `userId`).
 */
export async function markUserCartReminded(userId: string): Promise<void> {
  const now = new Date();
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastCartRemindedAt: now },
      });
      await prisma.cartItem.updateMany({
        where: { userId, checkedOut: false },
        data: { remindedAt: now },
      });
      return;
    } catch (error) {
      console.error('Prisma error marking cart reminded, falling back to local storage:', error);
    }
  }

  const users = readLocalUsers();
  const uIdx = users.findIndex(u => u.id === userId);
  if (uIdx >= 0) {
    users[uIdx].lastCartRemindedAt = now.toISOString();
    writeLocalUsers(users);
  }

  const cartItems = readLocalCartItems();
  for (const item of cartItems) {
    if (item.userId === userId && !item.checkedOut) {
      item.remindedAt = now.toISOString();
    }
  }
  writeLocalCartItems(cartItems);
}

/**
 * Removes synthetic test user data (and cascaded CartItems / UsualItems)
 * created during automated test runs so neither Neon nor local JSON is polluted.
 */
export async function removeTestData(userId: string): Promise<void> {
  if (!userId) return;

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      await prisma.user.deleteMany({
        where: { id: userId },
      });
    } catch (error) {
      console.error('Prisma error removing test user data, falling back to local cleanup:', error);
    }
  }

  const users = readLocalUsers().filter(u => u.id !== userId);
  writeLocalUsers(users);

  const cartItems = readLocalCartItems().filter(c => c.userId !== userId);
  writeLocalCartItems(cartItems);

  const favorites = readLocalFavorites().filter(f => f.userId !== userId);
  writeLocalFavorites(favorites);
}

