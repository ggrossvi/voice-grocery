import { describe, it, expect } from 'vitest';

// Known Seattle neighborhood store mappings
const STORE_ALIASES: Record<string, { locationId: string; officialName: string; chain: string }> = {
  'crown hill': { locationId: '70500872', officialName: 'Quality Food Center - Holman Road', chain: 'QFC' },
  'holman': { locationId: '70500872', officialName: 'Quality Food Center - Holman Road', chain: 'QFC' },
  'ballard qfc': { locationId: '70500891', officialName: 'Quality Food Center - Ballard', chain: 'QFC' },
  'ballard fred meyer': { locationId: '70100608', officialName: 'Fred Meyer - Ballard', chain: 'FRED' },
  'uptown': { locationId: '70500881', officialName: 'Quality Food Center - Uptown', chain: 'QFC' },
};

function resolveStoreAlias(query: string) {
  const q = query.toLowerCase().trim();
  for (const [alias, store] of Object.entries(STORE_ALIASES)) {
    if (q.includes(alias) || alias.includes(q)) {
      return store;
    }
  }
  return null;
}

describe('Store & Neighborhood Alias Resolution', () => {
  it('correctly maps Crown Hill queries to QFC Holman Road (70500872)', () => {
    const match1 = resolveStoreAlias('QFC Crown Hill');
    expect(match1).not.toBeNull();
    expect(match1?.locationId).toBe('70500872');
    expect(match1?.officialName).toBe('Quality Food Center - Holman Road');

    const match2 = resolveStoreAlias('Crown Hill');
    expect(match2?.locationId).toBe('70500872');

    const match3 = resolveStoreAlias('Holman Rd');
    expect(match3?.locationId).toBe('70500872');
  });

  it('resolves Ballard QFC vs Ballard Fred Meyer accurately', () => {
    const qfc = resolveStoreAlias('Ballard QFC');
    expect(qfc?.locationId).toBe('70500891');
    expect(qfc?.chain).toBe('QFC');

    const fred = resolveStoreAlias('Ballard Fred Meyer');
    expect(fred?.locationId).toBe('70100608');
    expect(fred?.chain).toBe('FRED');
  });
});
