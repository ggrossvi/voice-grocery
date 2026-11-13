/**
 * Personal Favorites Memory Engine (Tied to Signed-In User in Neon Postgres)
 *
 * Stores each user's favorite grocery products keyed by (userId, krogerUpc)
 * with zero fake starter items.
 */

import fs from 'fs';
import path from 'path';
import { FavoriteItem, KrogerProduct } from './types';
import { getPrismaClient } from './prisma';

const FAVORITES_FILE_PATH = path.join(process.cwd(), 'data', 'favorites.json');

export function isFavoriteItem(item: KrogerProduct | FavoriteItem): item is FavoriteItem {
  return 'krogerUpc' in item;
}

function mapPrismaRowToFavoriteItem(row: {
  id: string;
  userId: string;
  spokenKeyword: string;
  krogerUpc: string;
  title: string;
  brand: string | null;
  size: string | null;
  lastPrice: number | null;
  imageUrl: string | null;
  orderCount: number;
  lastOrderedAt: Date;
  isFavorite: boolean;
}): FavoriteItem {
  return {
    id: row.id,
    userId: row.userId,
    spokenKeyword: row.spokenKeyword,
    krogerUpc: row.krogerUpc,
    title: row.title,
    brand: row.brand ?? undefined,
    size: row.size ?? undefined,
    lastPrice: row.lastPrice ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    orderCount: row.orderCount,
    lastOrderedAt: row.lastOrderedAt.toISOString(),
    isFavorite: row.isFavorite,
  };
}

function ensureLocalFavoritesFile(): void {
  const dir = path.dirname(FAVORITES_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(FAVORITES_FILE_PATH)) {
    fs.writeFileSync(FAVORITES_FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function readLocalFavorites(): FavoriteItem[] {
  try {
    ensureLocalFavoritesFile();
    return JSON.parse(fs.readFileSync(FAVORITES_FILE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

export function writeLocalFavorites(items: FavoriteItem[]): void {
  ensureLocalFavoritesFile();
  fs.writeFileSync(FAVORITES_FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

/**
 * Returns all saved FavoriteItems for the signed-in userId, ordered by frequency.
 * Returns [] if no userId is provided (no fake starter items).
 */
export async function getFavoriteItems(userId?: string): Promise<FavoriteItem[]> {
  if (!userId) return [];

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.favoriteItem.findMany({
        where: { userId },
        orderBy: { orderCount: 'desc' },
      });
      return rows.map(mapPrismaRowToFavoriteItem);
    } catch (error) {
      console.error('Prisma error reading favorite items, falling back to local storage:', error);
    }
  }

  return readLocalFavorites()
    .filter(item => item.userId === userId)
    .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
}

/**
 * Fuzzy matches a spoken query against the signed-in user's saved favorites.
 */
export async function findFavoriteItem(
  spokenQuery: string,
  userId?: string
): Promise<FavoriteItem | null> {
  if (!userId) return null;
  const items = await getFavoriteItems(userId);
  const cleanedQuery = spokenQuery.toLowerCase().trim();

  if (!cleanedQuery) return null;

  // Direct keyword match
  const directMatch = items.find(
    item =>
      cleanedQuery === item.spokenKeyword.toLowerCase() ||
      cleanedQuery.includes(item.spokenKeyword.toLowerCase()) ||
      item.spokenKeyword.toLowerCase().includes(cleanedQuery)
  );

  if (directMatch) return directMatch;

  // Title match
  const titleMatch = items.find(
    item =>
      item.title.toLowerCase().includes(cleanedQuery) ||
      cleanedQuery.includes(item.title.toLowerCase())
  );

  return titleMatch || null;
}

/**
 * Saves a product as a FavoriteItem for the signed-in userId (or increments its orderCount).
 */
export async function recordFavoriteOrder(
  item: KrogerProduct | FavoriteItem,
  spokenKeyword?: string,
  userId?: string
): Promise<FavoriteItem> {
  if (!userId) {
    throw new Error('A signed-in userId is required to save a favorite item');
  }

  const itemUpc = isFavoriteItem(item) ? item.krogerUpc : item.upc;
  const itemPrice = isFavoriteItem(item) ? item.lastPrice : item.price;
  const itemTitle = isFavoriteItem(item) ? item.title : item.description;
  const resolvedKeyword =
    spokenKeyword ||
    (isFavoriteItem(item) ? item.spokenKeyword : itemTitle.split(' ')[0].toLowerCase());

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const upserted = await prisma.favoriteItem.upsert({
        where: {
          userId_krogerUpc: {
            userId,
            krogerUpc: itemUpc,
          },
        },
        update: {
          orderCount: { increment: 1 },
          lastOrderedAt: new Date(),
          ...(itemPrice !== undefined ? { lastPrice: itemPrice } : {}),
        },
        create: {
          userId,
          spokenKeyword: resolvedKeyword,
          krogerUpc: itemUpc,
          title: itemTitle,
          brand: item.brand ?? null,
          size: item.size ?? null,
          lastPrice: itemPrice ?? null,
          imageUrl: item.imageUrl ?? null,
          orderCount: 1,
          lastOrderedAt: new Date(),
          isFavorite: true,
        },
      });
      return mapPrismaRowToFavoriteItem(upserted);
    } catch (error) {
      console.error('Prisma error recording favorite order, falling back to local storage:', error);
    }
  }

  const items = readLocalFavorites();
  const existingIndex = items.findIndex(
    i => i.userId === userId && i.krogerUpc === itemUpc
  );

  if (existingIndex >= 0) {
    items[existingIndex].orderCount += 1;
    items[existingIndex].lastOrderedAt = new Date().toISOString();
    if (itemPrice !== undefined) items[existingIndex].lastPrice = itemPrice;
    writeLocalFavorites(items);
    return items[existingIndex];
  } else {
    const newItem: FavoriteItem = {
      id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      spokenKeyword: resolvedKeyword,
      krogerUpc: itemUpc,
      title: itemTitle,
      brand: item.brand,
      size: item.size,
      lastPrice: itemPrice,
      imageUrl: item.imageUrl,
      orderCount: 1,
      lastOrderedAt: new Date().toISOString(),
      isFavorite: true,
    };
    items.unshift(newItem);
    writeLocalFavorites(items);
    return newItem;
  }
}

/**
 * Deletes a FavoriteItem by id only if it belongs to the signed-in userId.
 */
export async function deleteFavoriteItem(id: string, userId?: string): Promise<boolean> {
  if (!id || !userId) return false;

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const result = await prisma.favoriteItem.deleteMany({
        where: { id, userId },
      });
      return result.count > 0;
    } catch (error) {
      console.error('Prisma error deleting favorite item, falling back to local storage:', error);
    }
  }

  const items = readLocalFavorites();
  const filtered = items.filter(i => !(i.id === id && i.userId === userId));
  if (filtered.length !== items.length) {
    writeLocalFavorites(filtered);
    return true;
  }
  return false;
}

