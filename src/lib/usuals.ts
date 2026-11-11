/**
 * Usual Items & Staples Memory Engine
 * 
 * Since Kroger's public developer API does not expose historical receipts or past orders,
 * this module maintains your personal purchase memory and staple items locally.
 */

import fs from 'fs';
import path from 'path';
import { UsualItem, KrogerProduct } from './types';

// Path to the local JSON file where staple items are persisted
const USUALS_FILE_PATH = path.join(process.cwd(), 'data', 'usuals.json');

// Type guard to determine if an object is a UsualItem
export function isUsualItem(item: KrogerProduct | UsualItem): item is UsualItem {
  return 'krogerUpc' in item;
}

// Default starter staples seeded on first run
const DEFAULT_STAPLES: UsualItem[] = [
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

function ensureStorageExists(): void {
  const dir = path.dirname(USUALS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USUALS_FILE_PATH)) {
    fs.writeFileSync(USUALS_FILE_PATH, JSON.stringify(DEFAULT_STAPLES, null, 2), 'utf-8');
  }
}

export function getUsualItems(): UsualItem[] {
  try {
    ensureStorageExists();
    const data = fs.readFileSync(USUALS_FILE_PATH, 'utf-8');
    const items: UsualItem[] = JSON.parse(data);
    return items.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
  } catch (error) {
    console.error('Error reading usual items storage:', error);
    return DEFAULT_STAPLES;
  }
}

export function findUsualItem(spokenQuery: string): UsualItem | null {
  const items = getUsualItems();
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

export function recordOrder(item: KrogerProduct | UsualItem, spokenKeyword?: string): UsualItem {
  const items = getUsualItems();
  const itemUpc = isUsualItem(item) ? item.krogerUpc : item.upc;
  const itemPrice = isUsualItem(item) ? item.lastPrice : item.price;
  const itemTitle = isUsualItem(item) ? item.title : item.description;

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
      spokenKeyword: spokenKeyword || itemTitle.split(' ')[0].toLowerCase(),
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

export function deleteUsualItem(id: string): boolean {
  const items = getUsualItems();
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length !== items.length) {
    fs.writeFileSync(USUALS_FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}
