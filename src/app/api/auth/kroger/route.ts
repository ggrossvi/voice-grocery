/**
 * Kroger OAuth Account Connection Route
 *
 * Route: GET /api/auth/kroger
 * Redirects the user to Kroger's OAuth2 login page to authorize cart additions (`cart.basic:write`)
 * and links their Kroger account to their signed-in Google User ID.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { APP_CONFIG } from '@/lib/config';
import { getKrogerAuthorizationUrl } from '@/lib/kroger';
import { KROGER_TOKEN_COOKIE, linkKrogerAccountToUser, USER_SESSION_COOKIE } from '@/lib/auth';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (APP_CONFIG.kroger.isConfigured() && ! request.url.includes('sandbox=1')) {
    const state = userId ? `user:${userId}` : 'guest';
    const authUrl = getKrogerAuthorizationUrl(state);
    return NextResponse.redirect(authUrl);
  }

  // Sandbox connection mode when testing locally without live Kroger OAuth redirect
  const sandboxToken = `sandbox_kroger_${Date.now()}`;
  if (userId) {
    await linkKrogerAccountToUser(userId, {
      accessToken: sandboxToken,
      refreshToken: `sandbox_refresh_${Date.now()}`,
      expiresIn: 1800,
    });
  }

  const response = NextResponse.redirect(`${origin}/?auth=kroger_connected`);
  response.cookies.set(KROGER_TOKEN_COOKIE, sandboxToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1800,
  });

  return response;
}

