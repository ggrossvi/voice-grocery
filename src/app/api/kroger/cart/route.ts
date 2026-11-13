/**
 * Kroger Cart Management API Route
 * 
 * Route: POST /api/kroger/cart
 * Adds an item to the Kroger cart, records it in personal purchase history,
 * and saves it to the signed-in Google user's CartItem table for cart reminders.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addToKrogerCart } from '@/lib/kroger';
import { recordFavoriteOrder } from '@/lib/favorites';
import {
  getValidKrogerTokenForUser,
  KROGER_TOKEN_COOKIE,
  recordUserCartItem,
  USER_SESSION_COOKIE,
} from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { item, quantity = 1, modality = 'PICKUP', spokenKeyword } = body;

    if (!item || (!item.upc && !item.krogerUpc)) {
      return NextResponse.json({ success: false, error: 'Valid item with UPC is required' }, { status: 400 });
    }

    const upc = item.upc || item.krogerUpc;
    const cookieStore = await cookies();
    const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
    const cookieToken = cookieStore.get(KROGER_TOKEN_COOKIE)?.value;
    const linkedToken = await getValidKrogerTokenForUser(userId);
    const token = linkedToken || cookieToken;

    // Call Kroger Cart API (PUT /v1/cart/add)
    const cartResult = await addToKrogerCart(upc, quantity, modality, token);

    // Save to the signed-in user's Favorites in Neon
    const updatedFavorite = userId
      ? await recordFavoriteOrder(item, spokenKeyword, userId)
      : null;

    // If signed in with Google, record item against userId & email for cart reminders
    const cartEntry = userId
      ? await recordUserCartItem(userId, item, quantity, modality)
      : null;

    return NextResponse.json({
      success: true,
      message: cartResult.message,
      item: updatedFavorite,
      cartEntry,
    });
  } catch (error: any) {
    console.error('Cart add error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
