import { describe, it, expect, vi, afterEach } from 'vitest';
import { isGroceryStoreLocation, getKrogerLocations } from '../src/lib/kroger';
import { APP_CONFIG } from '../src/lib/config';

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

  it('filters out non-grocery locations containing "Jewelers", "Fuel", or "Clinic(s)"', () => {
    expect(isGroceryStoreLocation('Quality Food Center - Holman Road', 'QFC')).toBe(true);
    expect(isGroceryStoreLocation('Fred Meyer - Ballard', 'FRED')).toBe(true);
    expect(isGroceryStoreLocation('Fred Meyer Jewelers - Northgate', 'FRED')).toBe(false);
    expect(isGroceryStoreLocation('QFC Fuel Center', 'QFC')).toBe(false);
    expect(isGroceryStoreLocation('Kroger Fuel Center #412', 'KROGER')).toBe(false);
    expect(isGroceryStoreLocation('The Little Clinic - Bellevue', 'KROGER')).toBe(false);
    expect(isGroceryStoreLocation('Kroger Health Clinics', 'KROGER')).toBe(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getKrogerLocations() excludes Jewelers, Fuel Centers, and Clinics from API results', async () => {
    APP_CONFIG.kroger.clientId = 'test_client_id';
    APP_CONFIG.kroger.clientSecret = 'test_client_secret';

    const mockFetch = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes('/v1/connect/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'mock_token_123', expires_in: 1800 }),
          { status: 200 }
        );
      }

      if (url.includes('/v1/locations')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                locationId: '70500872',
                name: 'Quality Food Center - Holman Road',
                chain: 'QFC',
                address: { addressLine1: '9999 Holman Rd NW', city: 'Seattle', state: 'WA', zipCode: '98117' },
              },
              {
                locationId: '70199991',
                name: 'Fred Meyer Jewelers - Ballard',
                chain: 'FRED',
                address: { addressLine1: '915 NW 45th St', city: 'Seattle', state: 'WA', zipCode: '98107' },
              },
              {
                locationId: '70599992',
                name: 'QFC Fuel Center - Crown Hill',
                chain: 'QFC',
                address: { addressLine1: '9999 Holman Rd NW', city: 'Seattle', state: 'WA', zipCode: '98117' },
              },
              {
                locationId: '01499993',
                name: 'The Little Clinic - Seattle',
                chain: 'KROGER',
                address: { addressLine1: '100 Main St', city: 'Seattle', state: 'WA', zipCode: '98101' },
              },
              {
                locationId: '01499994',
                name: 'Kroger Health Clinics',
                chain: 'KROGER',
                address: { addressLine1: '200 Main St', city: 'Seattle', state: 'WA', zipCode: '98101' },
              },
              {
                locationId: '70100608',
                name: 'Fred Meyer - Ballard',
                chain: 'FRED',
                address: { addressLine1: '915 NW 45th St', city: 'Seattle', state: 'WA', zipCode: '98107' },
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const stores = await getKrogerLocations({ zipCode: '98117' });

    expect(mockFetch).toHaveBeenCalled();
    expect(stores).toHaveLength(2);
    expect(stores.map(s => s.name)).toEqual([
      'Quality Food Center - Holman Road',
      'Fred Meyer - Ballard',
    ]);
  });
});
