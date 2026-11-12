/**
 * Kroger Cart Management API Route
 * 
 * Route: POST /api/kroger/cart
 * Adds an item to the Kroger cart and records it in personal purchase history.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addToKrogerCart } from '@/lib/kroger';
import { recordOrder } from '@/lib/usuals';
import { KrogerProduct, UsualItem } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { item, quantity = 1, modality = 'PICKUP', spokenKeyword } = body;

    if (!item || (!item.upc && !item.krogerUpc)) {
      return NextResponse.json({ success: false, error: 'Valid item with UPC is required' }, { status: 400 });
    }

    const upc = item.upc || item.krogerUpc;
    const cookieStore = await cookies();
    const token = cookieStore.get('kroger_token')?.value;

    // Call Kroger Cart API (PUT /v1/cart/add)
    const cartResult = await addToKrogerCart(upc, quantity, modality, token);

    // Save to our app's Usual Items memory engine
    const updatedUsual = await recordOrder(item, spokenKeyword);

    return NextResponse.json({
      success: true,
      message: cartResult.message,
      item: updatedUsual,
    });
  } catch (error: any) {
    console.error('Cart add error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
