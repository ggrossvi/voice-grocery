/**
 * Personal Favorites API Route
 *
 * Route: /api/favorites
 * GET: Retrieves all saved favorite items for the signed-in user sorted by order frequency
 * POST: Saves or records an order for a favorite item
 * DELETE: Removes a favorite item from the signed-in user's memory
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFavoriteItems, recordFavoriteOrder, deleteFavoriteItem } from '@/lib/favorites';
import { USER_SESSION_COOKIE } from '@/lib/auth';

// GET /api/favorites - List all favorite items for the signed-in user
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const items = await getFavoriteItems(userId);
  return NextResponse.json({ success: true, items });
}

// POST /api/favorites - Add or update a favorite item for the signed-in user
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Please sign in with Google to save favorites' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { item, spokenKeyword } = body;

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item data required' }, { status: 400 });
    }

    const saved = await recordFavoriteOrder(item, spokenKeyword, userId);
    return NextResponse.json({ success: true, item: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/favorites?id=... - Delete a favorite item for the signed-in user
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  const deleted = await deleteFavoriteItem(id, userId);
  return NextResponse.json({ success: deleted });
}

