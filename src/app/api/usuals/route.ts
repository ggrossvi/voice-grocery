/**
 * Staples & Usual Items API Route
 * 
 * Route: /api/usuals
 * GET: Retrieves all saved usual items sorted by order frequency
 * POST: Saves or records an order for a staple item
 * DELETE: Removes a staple item from memory
 */

import { NextResponse } from 'next/server';
import { getUsualItems, recordOrder, deleteUsualItem } from '@/lib/usuals';

// GET /api/usuals - List all usual items
export async function GET() {
  const items = await getUsualItems();
  return NextResponse.json({ success: true, items });
}

// POST /api/usuals - Add or update a staple item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { item, spokenKeyword } = body;

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item data required' }, { status: 400 });
    }

    const saved = await recordOrder(item, spokenKeyword);
    return NextResponse.json({ success: true, item: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/usuals?id=... - Delete a staple item
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  const deleted = await deleteUsualItem(id);
  return NextResponse.json({ success: deleted });
}
