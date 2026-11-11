import { describe, it, expect } from 'vitest';
import { findUsualItem, recordOrder, getUsualItems } from '@/lib/usuals';

describe('Usual Items & Staples Memory Engine', () => {
  it('loads starter staples including milk, eggs, and bread', () => {
    const staples = getUsualItems();
    expect(staples.length).toBeGreaterThanOrEqual(5);

    const keywords = staples.map(s => s.spokenKeyword);
    expect(keywords).toContain('milk');
    expect(keywords).toContain('eggs');
    expect(keywords).toContain('bread');
  });

  it('fuzzy matches spoken terms to the correct staple product', () => {
    const milkMatch = findUsualItem('milk');
    expect(milkMatch).not.toBeNull();
    expect(milkMatch?.title).toContain('Milk');
    expect(milkMatch?.krogerUpc).toBe('0001111041600');

    const eggsMatch = findUsualItem('eggs');
    expect(eggsMatch).not.toBeNull();
    expect(eggsMatch?.title).toContain('Eggs');

    // Partial phrase matching
    const wholeMilk = findUsualItem('whole milk');
    expect(wholeMilk).not.toBeNull();
    expect(wholeMilk?.krogerUpc).toBe('0001111041600');
  });

  it('returns null when an item is not in saved staples', () => {
    expect(findUsualItem('dragonfruit')).toBeNull();
    expect(findUsualItem('randomunknownitem')).toBeNull();
  });

  it('increments order count when recording an order for an existing staple', () => {
    const milk = findUsualItem('milk')!;
    const previousCount = milk.orderCount;

    const updated = recordOrder(milk);
    expect(updated.orderCount).toBe(previousCount + 1);
    expect(new Date(updated.lastOrderedAt).getTime()).toBeGreaterThan(0);
  });
});
