/**
 * Kroger OAuth2 Callback Handler
 * 
 * Route: GET /api/auth/kroger/callback
 * Kroger redirects back here with a '?code=...' query parameter.
 * We exchange that code for access and refresh tokens, and store them securely in an HTTP-only cookie.
 */

import { NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/kroger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const homeUrl = new URL('/', request.url);

  if (error || !code) {
    homeUrl.searchParams.set('auth_error', error || 'missing_code');
    return NextResponse.redirect(homeUrl);
  }

  try {
    // Exchange the authorization code for customer tokens
    const tokens = await exchangeCodeForTokens(code);

    homeUrl.searchParams.set('auth_success', 'true');
    const response = NextResponse.redirect(homeUrl);

    // Save access token into secure HTTP-only cookie
    response.cookies.set('kroger_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokens.expiresIn || 1800,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Kroger callback error:', err);
    homeUrl.searchParams.set('auth_error', encodeURIComponent(err.message));
    return NextResponse.redirect(homeUrl);
  }
}
