/**
 * Bulk Import Past Order Items API Route
 *
 * Route: POST /api/favorites/import
 *
 * Accepts a multi-line string of receipt or past-order item numbers (UPCs)
 * with optional spoken trigger keywords, looks up each product in the live
 * Kroger catalog using the user's Home Store (`preferredStoreId`), and saves
 * every matched item into the signed-in user's `FavoriteItem` list.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  parseUpcImportText,
  deriveDefaultKeyword,
  recordFavoriteOrder,
} from '@/lib/favorites';
import { getKrogerProductByUpc } from '@/lib/kroger';
import {
  USER_SESSION_COOKIE,
  getUserById,
  getValidKrogerTokenForUser,
} from '@/lib/auth';
import { FavoriteItem } from '@/lib/types';

/**
 * Resolves the signed-in user's preferred store locationId and Kroger OAuth token
 * so catalog lookups reflect accurate local pricing and stock.
 */
async function resolveStoreAndCustomerToken(
  userId: string,
  requestedLocationId?: string
): Promise<{ storeLocationId?: string; customerToken?: string }> {
  const user = await getUserById(userId);
  const storeLocationId = requestedLocationId || user?.preferredStoreId;
  const customerToken = (await getValidKrogerTokenForUser(userId)) || undefined;

  return { storeLocationId, customerToken };
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please sign in with Google before importing past order items.',
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawText = typeof body.rawText === 'string' ? body.rawText : '';
    const requestedLocationId =
      typeof body.locationId === 'string' ? body.locationId : undefined;

    const entries = parseUpcImportText(rawText);
    if (entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No valid 10-to-13 digit UPC numbers were found. Example: 0068954408301, yogurt',
        },
        { status: 400 }
      );
    }

    const { storeLocationId, customerToken } =
      await resolveStoreAndCustomerToken(userId, requestedLocationId);

    const imported: FavoriteItem[] = [];
    const notFound: string[] = [];

    for (const entry of entries) {
      const product = await getKrogerProductByUpc(
        entry.upc,
        storeLocationId,
        customerToken
      );

      if (!product) {
        notFound.push(entry.upc);
        continue;
      }

      const keywordToSave =
        entry.spokenKeyword ||
        deriveDefaultKeyword(product.description, product.brand);

      const savedFavorite = await recordFavoriteOrder(
        product,
        keywordToSave,
        userId
      );
      imported.push(savedFavorite);
    }

    return NextResponse.json({
      success: true,
      imported,
      notFound,
    });
  } catch (error: any) {
    console.error('Error in POST /api/favorites/import:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import past order items.',
      },
      { status: 500 }
    );
  }
}
