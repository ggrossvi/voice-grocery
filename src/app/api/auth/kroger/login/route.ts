/**
 * Kroger OAuth2 Login Initiator
 * 
 * Route: GET /api/auth/kroger/login
 * Redirects the user to Kroger's official login screen to grant cart access.
 */

import { NextResponse } from 'next/server';
import { getKrogerAuthorizationUrl } from '@/lib/kroger';
import { APP_CONFIG } from '@/lib/config';

export async function GET(request: Request) {
  // If Kroger API credentials are not yet configured in .env.local,
  // gracefully fall back to Sandbox Mode so the user can test the app immediately.
  if (!APP_CONFIG.kroger.isConfigured()) {
    const homeUrl = new URL('/', request.url);
    homeUrl.searchParams.set('mode', 'sandbox');
    return NextResponse.redirect(homeUrl);
  }

  // Redirect to official Kroger OAuth dialog
  const authUrl = getKrogerAuthorizationUrl();
  return NextResponse.redirect(authUrl);
}
