/**
 * Google OAuth 2.0 Callback Route
 *
 * Route: GET /api/auth/google/callback
 * Exchanges the Google authorization code for the user's Google ID (`sub`) and `email`,
 * saves the user in the database, sets the session cookie, and redirects to `/`.
 */

import { NextResponse } from 'next/server';
import { exchangeGoogleCodeForProfile, upsertGoogleUser, USER_SESSION_COOKIE } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error || 'missing_code')}`);
  }

  try {
    const profile = await exchangeGoogleCodeForProfile(code);
    const user = await upsertGoogleUser(profile);

    const response = NextResponse.redirect(`${origin}/?auth=google_connected`);
    response.cookies.set(USER_SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(err.message || 'google_oauth_failed')}`);
  }
}

