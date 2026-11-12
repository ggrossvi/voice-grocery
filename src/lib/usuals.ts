/**
 * Usual Items & Staples Memory Engine (Smart Switch: Neon Postgres + Local JSON Fallback)
 * 
 * Since Kroger's public developer API does not expose historical receipts or past orders,
 * this module maintains your personal purchase memory and staple items.
 *
 * Smart Switch behavior:
 * - When DATABASE_URL is configured (e.g. Neon Postgres on Vercel or locally), queries Prisma.
 * - When DATABASE_URL is not set, automatically falls back to local `data/usuals.json`.
 */

import fs from 'fs';
import path from 'path';
import { UsualItem, KrogerProduct } from './types';
import { getPrismaClient } from './prisma';

// Path to the local JSON file where staple items are persisted when DATABASE_URL is not set
const USUALS_FILE_PATH = path.join(process.cwd(), 'data', 'usuals.json');

// Type guard to determine if an object is a UsualItem
export function isUsualItem(item: KrogerProduct | UsualItem): item is UsualItem {
  return 'krogerUpc' in item;
}

// Default starter staples seeded on first run
export const DEFAULT_STAPLES: UsualItem[] = [
  {
    id: 'staple-milk-01',
    spokenKeyword: 'milk',
    krogerUpc: '0001111041600',
    title: 'Kroger® Vitamin D Whole Milk',
    brand: 'Kroger',
    size: '1 gal',
    lastPrice: 3.29,
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    orderCount: 8,
    lastOrderedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isStaple: true,
  },
  {
    id: 'staple-eggs-02',
    spokenKeyword: 'eggs',
    krogerUpc: '0001111060903',
    title: 'Kroger® Grade A Large White Eggs',
    brand: 'Kroger',
    size: '12 ct',
    lastPrice: 2.49,
    imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=400&q=80',
    orderCount: 6,
    lastOrderedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    isStaple: true,
  },
  {
    id: 'staple-bread-03',
    spokenKeyword: 'bread',
    krogerUpc: '0001111000119',
    title: 'Kroger® Enriched White Sandwich Bread',
    brand: 'Kroger',
    size: '20 oz',
    lastPrice: 1.79,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    orderCount: 5,
    lastOrderedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isStaple: true,
  },
  {
    id: 'staple-butter-04',
    spokenKeyword: 'butter',
    krogerUpc: '0001111089201',
    title: 'Kroger® Sweet Cream Salted Butter Sticks',
    brand: 'Kroger',
    size: '4 ct / 16 oz',
    lastPrice: 3.99,
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80',
    orderCount: 4,
    lastOrderedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    isStaple: true,
  },
  {
    id: 'staple-bananas-05',
    spokenKeyword: 'bananas',
    krogerUpc: '0000000004011',
    title: 'Fresh Cavendish Yellow Bananas',
    brand: 'Produce',
    size: 'approx. 1 bunch / 2 lb',
    lastPrice: 1.18,
    imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80',
    orderCount: 9,
    lastOrderedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isStaple: true,
  },
  {
    id: 'staple-coffee-06',
    spokenKeyword: 'coffee',
    krogerUpc: '0001111086050',
    title: 'Private Selection® Costa Rica Medium Roast Ground Coffee',
    brand: 'Private Selection',
    size: '12 oz',
    lastPrice: 6.99,
    imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=400&q=80',
    orderCount: 3,
    lastOrderedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    isStaple: true,
  }
];

function mapPrismaRowToUsualItem(row: {
  id: string;
  spokenKeyword: string;
  krogerUpc: string;
  title: string;
  brand: string | null;
  size: string | null;
  lastPrice: number | null;
  imageUrl: string | null;
  orderCount: number;
  lastOrderedAt: Date;
  isStaple: boolean;
}): UsualItem {
  return {
    id: row.id,
    spokenKeyword: row.spokenKeyword,
    krogerUpc: row.krogerUpc,
    title: row.title,
    brand: row.brand ?? undefined,
    size: row.size ?? undefined,
    lastPrice: row.lastPrice ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    orderCount: row.orderCount,
    lastOrderedAt: row.lastOrderedAt.toISOString(),
    isStaple: row.isStaple,
  };
}

function ensureLocalStorageExists(): void {
  const dir = path.dirname(USUALS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USUALS_FILE_PATH)) {
    fs.writeFileSync(USUALS_FILE_PATH, JSON.stringify(DEFAULT_STAPLES, null, 2), 'utf-8');
  }
}

function getLocalUsualItems(): UsualItem[] {
  try {
    ensureLocalStorageExists();
    const data = fs.readFileSync(USUALS_FILE_PATH, 'utf-8');
    const items: UsualItem[] = JSON.parse(data);
    return items.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
  } catch (error) {
    console.error('Error reading usual items storage:', error);
    return DEFAULT_STAPLES;
  }
}

export async function getUsualItems(): Promise<UsualItem[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      let rows = await prisma.usualItem.findMany({
        orderBy: { orderCount: 'desc' },
      });

      // Seed starter staples on first run when table is empty
      if (rows.length === 0) {
        await prisma.usualItem.createMany({
          data: DEFAULT_STAPLES.map(s => ({
            id: s.id,
            spokenKeyword: s.spokenKeyword,
            krogerUpc: s.krogerUpc,
            title: s.title,
            brand: s.brand ?? null,
            size: s.size ?? null,
            lastPrice: s.lastPrice ?? null,
            imageUrl: s.imageUrl ?? null,
            orderCount: s.orderCount,
            lastOrderedAt: new Date(s.lastOrderedAt),
            isStaple: s.isStaple,
          })),
          skipDuplicates: true,
        });

        rows = await prisma.usualItem.findMany({
          orderBy: { orderCount: 'desc' },
        });
      }

      return rows.map(mapPrismaRowToUsualItem);
    } catch (error) {
      console.error('Prisma error reading usual items, falling back to local storage:', error);
    }
  }

  return getLocalUsualItems();
}

export async function findUsualItem(spokenQuery: string): Promise<UsualItem | null> {
  const items = await getUsualItems();
  const cleanedQuery = spokenQuery.toLowerCase().trim();

  if (!cleanedQuery) return null;

  // Direct keyword match
  const directMatch = items.find(item => 
    cleanedQuery === item.spokenKeyword.toLowerCase() ||
    cleanedQuery.includes(item.spokenKeyword.toLowerCase()) ||
    item.spokenKeyword.toLowerCase().includes(cleanedQuery)
  );

  if (directMatch) return directMatch;

  // Title match
  const titleMatch = items.find(item => 
    item.title.toLowerCase().includes(cleanedQuery) ||
    cleanedQuery.includes(item.title.toLowerCase())
  );

  return titleMatch || null;
}

export async function recordOrder(item: KrogerProduct | UsualItem, spokenKeyword?: string): Promise<UsualItem> {
  const itemUpc = isUsualItem(item) ? item.krogerUpc : item.upc;
  const itemPrice = isUsualItem(item) ? item.lastPrice : item.price;
  const itemTitle = isUsualItem(item) ? item.title : item.description;
  const resolvedKeyword = spokenKeyword || (isUsualItem(item) ? item.spokenKeyword : itemTitle.split(' ')[0].toLowerCase());

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const upserted = await prisma.usualItem.upsert({
        where: { krogerUpc: itemUpc },
        update: {
          orderCount: { increment: 1 },
          lastOrderedAt: new Date(),
          ...(itemPrice !== undefined ? { lastPrice: itemPrice } : {}),
        },
        create: {
          spokenKeyword: resolvedKeyword,
          krogerUpc: itemUpc,
          title: itemTitle,
          brand: item.brand ?? null,
          size: item.size ?? null,
          lastPrice: itemPrice ?? null,
          imageUrl: item.imageUrl ?? null,
          orderCount: 1,
          lastOrderedAt: new Date(),
          isStaple: true,
        },
      });
      return mapPrismaRowToUsualItem(upserted);
    } catch (error) {
      console.error('Prisma error recording order, falling back to local storage:', error);
    }
  }

  const items = getLocalUsualItems();
  const existingIndex = items.findIndex(i => i.krogerUpc === itemUpc);

  if (existingIndex >= 0) {
    items[existingIndex].orderCount += 1;
    items[existingIndex].lastOrderedAt = new Date().toISOString();
    if (itemPrice) items[existingIndex].lastPrice = itemPrice;
    fs.writeFileSync(USUALS_FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
    return items[existingIndex];
  } else {
    const newItem: UsualItem = {
      id: `staple-${Date.now()}`,
      spokenKeyword: resolvedKeyword,
      krogerUpc: itemUpc,
      title: itemTitle,
      brand: item.brand,
      size: item.size,
      lastPrice: itemPrice,
      imageUrl: item.imageUrl,
      orderCount: 1,
      lastOrderedAt: new Date().toISOString(),
      isStaple: true,
    };
    items.unshift(newItem);
    fs.writeFileSync(USUALS_FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
    return newItem;
  }
}

export async function deleteUsualItem(id: string): Promise<boolean> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const result = await prisma.usualItem.deleteMany({
        where: { id },
      });
      return result.count > 0;
    } catch (error) {
      console.error('Prisma error deleting usual item, falling back to local storage:', error);
    }
  }

  const items = getLocalUsualItems();
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length !== items.length) {
    fs.writeFileSync(USUALS_FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}
