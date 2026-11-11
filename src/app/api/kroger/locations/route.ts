/**
 * Kroger Store Locations API Route
 * 
 * Route: GET /api/kroger/locations
 * Query params: ?zip=98101 OR ?lat=47.6062&long=-122.3321
 * Returns 5 closest stores (QFC, Fred Meyer, Kroger, etc.)
 */

import { NextResponse } from 'next/server';
import { getKrogerLocations } from '@/lib/kroger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip') || undefined;
  const latStr = searchParams.get('lat');
  const longStr = searchParams.get('long');

  const lat = latStr ? parseFloat(latStr) : undefined;
  const long = longStr ? parseFloat(longStr) : undefined;

  try {
    const stores = await getKrogerLocations({ lat, long, zipCode: zip });
    return NextResponse.json({ success: true, stores });
  } catch (error: any) {
    console.error('Error in locations route:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
