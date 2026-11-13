import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getFavoriteItems,
  findFavoriteItem,
  recordFavoriteOrder,
  deleteFavoriteItem,
} from '@/lib/favorites';
import { upsertGoogleUser, removeTestData } from '@/lib/auth';
import { isDatabaseConfigured } from '@/lib/prisma';

describe('Favorites Memory Engine (Per-User)', () => {
  const testUserA = `google-sub-favA-${Date.now()}`;
  const testUserB = `google-sub-favB-${Date.now()}`;

  beforeAll(async () => {
    await upsertGoogleUser({
      googleId: testUserA,
      email: `fav-a-${Date.now()}@gmail.com`,
      name: 'Shopper A',
    });
    await upsertGoogleUser({
      googleId: testUserB,
      email: `fav-b-${Date.now()}@gmail.com`,
      name: 'Shopper B',
    });
  });

  afterAll(async () => {
    await removeTestData(testUserA);
    await removeTestData(testUserB);
  });

  it('requires a signed-in userId to save and retrieve favorites without fake starter items', async () => {
    // Unsigned-in guest call returns empty array (no fake starter items)
    const guestItems = await getFavoriteItems();
    expect(guestItems).toEqual([]);

    // Newly created user starts with 0 favorites (no fake starter items)
    const emptyUserFavorites = await getFavoriteItems(testUserA);
    expect(emptyUserFavorites).toEqual([]);

    // Saving a real product ties it to testUserA
    const saved = await recordFavoriteOrder(
      {
        upc: '0068954408301',
        description: 'Fage® Total Plain Nonfat Greek Yogurt Tub',
        brand: 'Fage',
        size: '32 oz',
        price: 7.29,
      },
      'yogurt',
      testUserA
    );

    expect(saved.userId).toBe(testUserA);
    expect(saved.krogerUpc).toBe('0068954408301');
    expect(saved.spokenKeyword).toBe('yogurt');
    expect(saved.orderCount).toBe(1);
    expect(saved.isFavorite).toBe(true);
  });

  it('isolates favorites per user (@@unique([userId, krogerUpc]))', async () => {
    // User B has 0 favorites even though User A saved yogurt
    const userBInitial = await getFavoriteItems(testUserB);
    expect(userBInitial).toEqual([]);

    // User B can save the exact same UPC without colliding with User A
    const savedForB = await recordFavoriteOrder(
      {
        upc: '0068954408301',
        description: 'Fage® Total Plain Nonfat Greek Yogurt Tub',
        brand: 'Fage',
        size: '32 oz',
        price: 7.29,
      },
      'greek yogurt',
      testUserB
    );

    expect(savedForB.userId).toBe(testUserB);
    expect(savedForB.spokenKeyword).toBe('greek yogurt');

    const userAFavorites = await getFavoriteItems(testUserA);
    const userBFavorites = await getFavoriteItems(testUserB);

    expect(userAFavorites.length).toBe(1);
    expect(userAFavorites[0].spokenKeyword).toBe('yogurt');
    expect(userBFavorites.length).toBe(1);
    expect(userBFavorites[0].spokenKeyword).toBe('greek yogurt');
  });

  it('fuzzy matches spoken terms to the user saved favorite product', async () => {
    const exactMatch = await findFavoriteItem('yogurt', testUserA);
    expect(exactMatch).not.toBeNull();
    expect(exactMatch?.krogerUpc).toBe('0068954408301');

    // Partial title match
    const titleMatch = await findFavoriteItem('fage', testUserA);
    expect(titleMatch).not.toBeNull();
    expect(titleMatch?.krogerUpc).toBe('0068954408301');

    // Unknown item returns null
    expect(await findFavoriteItem('dragonfruit', testUserA)).toBeNull();
  });

  it('increments orderCount and updates lastPrice when re-ordering an existing favorite', async () => {
    const existing = (await findFavoriteItem('yogurt', testUserA))!;
    const prevCount = existing.orderCount;

    const updated = await recordFavoriteOrder(
      { ...existing, lastPrice: 6.99 },
      'yogurt',
      testUserA
    );

    expect(updated.orderCount).toBe(prevCount + 1);
    expect(updated.lastPrice).toBe(6.99);
    expect(new Date(updated.lastOrderedAt).getTime()).toBeGreaterThan(0);
  });

  it('deletes a favorite item only for the owning userId', async () => {
    const userBItem = (await findFavoriteItem('greek yogurt', testUserB))!;

    // User A cannot delete User B's favorite
    const wrongUserDelete = await deleteFavoriteItem(userBItem.id, testUserA);
    expect(wrongUserDelete).toBe(false);

    // User B can delete their own favorite
    const deleted = await deleteFavoriteItem(userBItem.id, testUserB);
    expect(deleted).toBe(true);

    const remainingB = await getFavoriteItems(testUserB);
    expect(remainingB).toEqual([]);
  });

  it('detects smart switch database configuration status from DATABASE_URL', () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      expect(isDatabaseConfigured()).toBe(false);

      process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
      expect(isDatabaseConfigured()).toBe(true);
    } finally {
      if (originalUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalUrl;
      }
    }
  });
});

