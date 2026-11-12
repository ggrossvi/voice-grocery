import { describe, it, expect } from 'vitest';
import { findUsualItem, recordOrder, getUsualItems } from '@/lib/usuals';
import { isDatabaseConfigured } from '@/lib/prisma';

describe('Usual Items & Staples Memory Engine', () => {
  it('loads starter staples including milk, eggs, and bread', async () => {
    const staples = await getUsualItems();
    expect(staples.length).toBeGreaterThanOrEqual(5);

    const keywords = staples.map(s => s.spokenKeyword);
    expect(keywords).toContain('milk');
    expect(keywords).toContain('eggs');
    expect(keywords).toContain('bread');
  });

  it('fuzzy matches spoken terms to the correct staple product', async () => {
    const milkMatch = await findUsualItem('milk');
    expect(milkMatch).not.toBeNull();
    expect(milkMatch?.title).toContain('Milk');
    expect(milkMatch?.krogerUpc).toBe('0001111041600');

    const eggsMatch = await findUsualItem('eggs');
    expect(eggsMatch).not.toBeNull();
    expect(eggsMatch?.title).toContain('Eggs');

    // Partial phrase matching
    const wholeMilk = await findUsualItem('whole milk');
    expect(wholeMilk).not.toBeNull();
    expect(wholeMilk?.krogerUpc).toBe('0001111041600');
  });

  it('returns null when an item is not in saved staples', async () => {
    expect(await findUsualItem('dragonfruit')).toBeNull();
    expect(await findUsualItem('randomunknownitem')).toBeNull();
  });

  it('increments order count when recording an order for an existing staple', async () => {
    const milk = (await findUsualItem('milk'))!;
    const previousCount = milk.orderCount;

    const updated = await recordOrder(milk);
    expect(updated.orderCount).toBe(previousCount + 1);
    expect(new Date(updated.lastOrderedAt).getTime()).toBeGreaterThan(0);
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
