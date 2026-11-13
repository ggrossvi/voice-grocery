import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { normalizeKrogerUpc } from '@/lib/kroger';
import {
  parseUpcImportText,
  deriveDefaultKeyword,
  recordFavoriteOrder,
  getFavoriteItems,
} from '@/lib/favorites';
import { upsertGoogleUser, removeTestData } from '@/lib/auth';

describe('Import Past Order Items (UPC Normalization & Bulk Favorites Import)', () => {
  const testUserId = `google-sub-import-${Date.now()}`;

  beforeAll(async () => {
    await upsertGoogleUser({
      googleId: testUserId,
      email: `import-test-${Date.now()}@gmail.com`,
      name: 'Past Order Importer',
    });
  });

  afterAll(async () => {
    await removeTestData(testUserId);
  });

  it('normalizes 10, 11, 12, and 13-digit receipt numbers into 13-digit Kroger UPCs', () => {
    // 11-digit number -> padded with 2 leading zeros to 13 digits
    expect(normalizeKrogerUpc('68954408301')).toBe('0068954408301');

    // 10-digit receipt number with dashes/spaces -> stripped and padded to 13 digits
    expect(normalizeKrogerUpc('0111-1041-60')).toBe('0000111104160');

    // Already 13 digits -> preserved as-is
    expect(normalizeKrogerUpc('0068954408301')).toBe('0068954408301');

    // Invalid input (letters, too short, or too long) -> returns null
    expect(normalizeKrogerUpc('not-a-upc')).toBeNull();
    expect(normalizeKrogerUpc('12345')).toBeNull();
    expect(normalizeKrogerUpc('123456789012345')).toBeNull();
  });

  it('parses multi-line import input with or without custom spoken keywords', () => {
    const rawInput = [
      '0068954408301, greek yogurt',
      '0001111041600 - milk',
      '68954408302',
      '', // blank line should be ignored
      'invalid-line-without-upc', // invalid UPC should be ignored
    ].join('\n');

    const parsed = parseUpcImportText(rawInput);

    expect(parsed).toEqual([
      { upc: '0068954408301', spokenKeyword: 'greek yogurt' },
      { upc: '0001111041600', spokenKeyword: 'milk' },
      { upc: '0068954408302', spokenKeyword: undefined },
    ]);
  });

  it('derives a clean spoken keyword when only a UPC is provided', () => {
    // Strips trademark symbols and packaging noise to produce a natural spoken phrase
    const yogurtKeyword = deriveDefaultKeyword(
      'Fage® Total Plain Nonfat Greek Yogurt Tub',
      'Fage'
    );
    expect(yogurtKeyword).toBe('greek yogurt');

    const milkKeyword = deriveDefaultKeyword(
      'Kroger® 2% Reduced Fat Milk Gallon',
      'Kroger'
    );
    expect(milkKeyword).toBe('reduced fat milk');
  });

  it('imports looked-up products into the signed-in user FavoriteItem list', async () => {
    const entries = parseUpcImportText('68954408301, yogurt\n0001111041600');
    expect(entries.length).toBe(2);

    // Simulate looking up both UPCs from Kroger catalog and recording them
    const mockCatalogProducts = [
      {
        upc: entries[0].upc,
        description: 'Fage® Total Plain Nonfat Greek Yogurt Tub',
        brand: 'Fage',
        size: '32 oz',
        price: 7.29,
      },
      {
        upc: entries[1].upc,
        description: 'Kroger® 2% Reduced Fat Milk Gallon',
        brand: 'Kroger',
        size: '1 gal',
        price: 3.79,
      },
    ];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const product = mockCatalogProducts[i];
      const keyword =
        entry.spokenKeyword || deriveDefaultKeyword(product.description, product.brand);
      await recordFavoriteOrder(product, keyword, testUserId);
    }

    const savedFavorites = await getFavoriteItems(testUserId);
    expect(savedFavorites.length).toBe(2);

    const byUpc = Object.fromEntries(savedFavorites.map(item => [item.krogerUpc, item]));
    expect(byUpc['0068954408301']?.spokenKeyword).toBe('yogurt');
    expect(byUpc['0001111041600']?.spokenKeyword).toBe('reduced fat milk');
  });
});
