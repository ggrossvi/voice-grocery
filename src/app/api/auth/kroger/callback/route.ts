/**
 * Kroger OAuth2 Callback Route
 *
 * Route: GET /api/auth/kroger/callback
 * Exchanges the Kroger authorization code for customer tokens and links them
 * to the signed-in Google User row in the database.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens } from '@/lib/kroger';
import { KROGER_TOKEN_COOKIE, linkKrogerAccountToUser, USER_SESSION_COOKIE } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || '';
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error || 'kroger_missing_code')}`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const cookieStore = await cookies();
    const stateUserId = state.startsWith('user:') ? state.slice(5) : undefined;
    const userId = cookieStore.get(USER_SESSION_COOKIE)?.value || stateUserId;

    if (userId) {
      await linkKrogerAccountToUser(userId, tokens);
    }

    const response = NextResponse.redirect(`${origin}/?auth=kroger_connected`);
    response.cookies.set(KROGER_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: tokens.expiresIn || 1800,
    });

    return response;
  } catch (err: any) {
    console.error('Kroger OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(err.message || 'kroger_oauth_failed')}`);
  }
}
