/**
 * Google Sign-In Initiation Route
 *
 * Route: GET /api/auth/google
 * Redirects user to Google OAuth 2.0 consent screen.
 * If GOOGLE_CLIENT_ID is not configured locally, supports a sandbox/demo Google sign-in
 * so developers can test the full Google ID + email + Kroger linking flow immediately.
 */

import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@/lib/config';
import { getGoogleAuthorizationUrl, upsertGoogleUser, USER_SESSION_COOKIE } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // If real Google OAuth credentials are configured, redirect to Google
  if (APP_CONFIG.google.isConfigured()) {
    const authUrl = getGoogleAuthorizationUrl('google_signin');
    return NextResponse.redirect(authUrl);
  }

  // Fallback for local development before GOOGLE_CLIENT_ID is set in .env
  const demoEmail = searchParams.get('email') || 'shopper@gmail.com';
  const demoGoogleId = searchParams.get('id') || 'google-oauth2-109876543210';
  const demoName = searchParams.get('name') || 'Google Shopper';

  const user = await upsertGoogleUser({
    googleId: demoGoogleId,
    email: demoEmail,
    name: demoName,
  });

  const response = NextResponse.redirect(`${origin}/?auth=google_connected`);
  response.cookies.set(USER_SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

