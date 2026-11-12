/**
 * Kroger Developer API Client
 * 
 * Supports:
 * 1. Automated Client Credentials token management
 * 2. 5-Store Location Lookup (/v1/locations) via GPS or Zip Code
 * 3. Live Product Catalog Search (/v1/products)
 * 4. Customer OAuth Cart Additions (/v1/cart/add)
 */

import { APP_CONFIG } from './config';
import { KrogerProduct, KrogerCartAddRequest, KrogerStoreLocation } from './types';

// In-memory cache for the Client Credentials token
let cachedClientToken: { token: string; expiresAt: number } | null = null;

/**
 * Obtains a Client Credentials OAuth token from Kroger.
 * Caches the token in memory to avoid repeated authentication round-trips.
 */
export async function getClientCredentialsToken(): Promise<string> {
  const now = Date.now();

  if (cachedClientToken && cachedClientToken.expiresAt > now + 60000) {
    return cachedClientToken.token;
  }

  const clientId = APP_CONFIG.kroger.clientId.trim();
  const clientSecret = APP_CONFIG.kroger.clientSecret.trim();

  if (!clientId || !clientSecret) {
    throw new Error('Kroger Client ID and Secret are not configured in .env');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${APP_CONFIG.kroger.baseUrl}/v1/connect/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'product.compact',
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Kroger Client token (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedClientToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in * 1000),
  };

  return data.access_token;
}

/**
 * Queries Kroger Locations API to find the 5 closest stores by GPS coordinates or Zip Code.
 */
export async function getKrogerLocations(params: {
  lat?: number;
  long?: number;
  zipCode?: string;
}): Promise<KrogerStoreLocation[]> {
  try {
    const token = await getClientCredentialsToken();
    const url = new URL(`${APP_CONFIG.kroger.baseUrl}/v1/locations`);
    url.searchParams.set('filter.limit', '10');
    url.searchParams.set('filter.radiusInMiles', '20');

    if (params.lat !== undefined && params.long !== undefined) {
      url.searchParams.set('filter.latLong.near', `${params.lat},${params.long}`);
    } else if (params.zipCode) {
      url.searchParams.set('filter.zipCode.near', params.zipCode);
    } else {
      url.searchParams.set('filter.zipCode.near', '98101'); // Default fallback Seattle
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Kroger locations search returned ${response.status}:`, errText);
      return [];
    }

    const data = await response.json();
    const rawLocations = data.data || [];

    return rawLocations.map((loc: any) => ({
      locationId: loc.locationId,
      name: loc.name || loc.address?.addressLine1,
      chain: loc.chain || 'Kroger',
      address: {
        addressLine1: loc.address?.addressLine1 || '',
        city: loc.address?.city || '',
        state: loc.address?.state || '',
        zipCode: loc.address?.zipCode || '',
      },
      phone: loc.phone || '',
    }));
  } catch (error) {
    console.error('Error fetching Kroger locations:', error);
    return [];
  }
}

/**
 * Searches the live Kroger Product Catalog (GET /v1/products)
 */
export async function searchKrogerProducts(
  query: string,
  locationId?: string,
  customerToken?: string
): Promise<KrogerProduct[]> {
  try {
    const token = customerToken || await getClientCredentialsToken();

    const url = new URL(`${APP_CONFIG.kroger.baseUrl}/v1/products`);
    url.searchParams.set('filter.term', query);
    url.searchParams.set('filter.limit', '4');

    // Only apply locationId filter if a valid store locationId is provided
    const storeLocation = locationId || APP_CONFIG.kroger.defaultLocationId;
    if (storeLocation) {
      url.searchParams.set('filter.locationId', storeLocation);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Kroger product search returned ${response.status}:`, errText);
      return [];
    }

    const data = await response.json();
    const rawProducts = data.data || [];

    return rawProducts.map((p: any) => {
      const itemDetail = p.items?.[0] || {};
      const priceDetail = itemDetail.price || {};

      let imageUrl: string | undefined;
      const frontImage = p.images?.find((img: any) => img.perspective === 'front') || p.images?.[0];
      if (frontImage?.sizes?.length) {
        const mediumSize = frontImage.sizes.find((s: any) => s.size === 'medium' || s.size === 'large') || frontImage.sizes[0];
        imageUrl = mediumSize?.url;
      }

      return {
        upc: p.upc,
        description: p.description,
        brand: p.brand || 'Kroger',
        size: itemDetail.size || '',
        price: priceDetail.regular || priceDetail.promo || undefined,
        imageUrl: imageUrl,
        category: p.categories?.[0] || '',
        inStock: itemDetail.inventory?.stockLevel !== 'TEMPORARILY_OUT_OF_STOCK',
      };
    });
  } catch (error) {
    console.error('Error in searchKrogerProducts:', error);
    return [];
  }
}

/**
 * Builds the official Kroger OAuth2 authorization login URL.
 */
export function getKrogerAuthorizationUrl(state: string = 'auth'): string {
  const params = new URLSearchParams({
    client_id: APP_CONFIG.kroger.clientId,
    redirect_uri: APP_CONFIG.kroger.redirectUri,
    response_type: 'code',
    scope: APP_CONFIG.kroger.scopes,
    state: state,
  });
  return `${APP_CONFIG.kroger.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchanges the authorization code for customer tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const credentials = Buffer.from(
    `${APP_CONFIG.kroger.clientId}:${APP_CONFIG.kroger.clientSecret}`
  ).toString('base64');

  const response = await fetch(APP_CONFIG.kroger.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: APP_CONFIG.kroger.redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kroger Token Exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refreshes an expired customer Kroger access token using a saved refresh token
 */
export async function refreshKrogerToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const credentials = Buffer.from(
    `${APP_CONFIG.kroger.clientId}:${APP_CONFIG.kroger.clientSecret}`
  ).toString('base64');

  const response = await fetch(APP_CONFIG.kroger.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kroger Token Refresh failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  };
}

/**
 * Adds an item to the Kroger Customer Cart (PUT /v1/cart/add)
 */
export async function addToKrogerCart(
  upc: string,
  quantity: number = 1,
  modality: 'PICKUP' | 'DELIVERY' = 'PICKUP',
  accessToken?: string
): Promise<{ success: boolean; message: string }> {
  if (!accessToken || accessToken.startsWith('sandbox_')) {
    console.log(`[SIMULATED CART] Added UPC ${upc} (qty: ${quantity}, modality: ${modality})`);
    return {
      success: true,
      message: `Item (${upc}) added to your Kroger cart (Simulated)`,
    };
  }

  const payload: KrogerCartAddRequest = {
    items: [
      {
        upc: upc.padStart(13, '0'),
        quantity: quantity,
        modality: modality,
      }
    ]
  };

  const response = await fetch(`${APP_CONFIG.kroger.baseUrl}/v1/cart/add`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 204 || response.status === 200) {
    return {
      success: true,
      message: 'Item successfully added to your live Kroger cart!',
    };
  }

  const errorText = await response.text();
  throw new Error(`Failed to add item to Kroger cart (${response.status}): ${errorText}`);
}
