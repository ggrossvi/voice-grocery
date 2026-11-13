/**
 * Current Authenticated Session & Cart Reminder Status Route
 *
 * Route:
 * - GET /api/auth/me: Returns the signed-in Google user profile, Kroger link status, and active cart items
 * - DELETE /api/auth/me: Signs out the current user
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getUserActiveCartItems,
  getUserById,
  KROGER_TOKEN_COOKIE,
  updateUserPreferredStore,
  USER_SESSION_COOKIE,
} from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const krogerCookie = cookieStore.get(KROGER_TOKEN_COOKIE)?.value;

  if (!userId) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      krogerConnected: Boolean(krogerCookie),
      cartItems: [],
      cartReminder: null,
    });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      krogerConnected: Boolean(krogerCookie),
      cartItems: [],
      cartReminder: null,
    });
  }

  const cartItems = await getUserActiveCartItems(user.id);
  const krogerConnected = user.krogerConnected || Boolean(krogerCookie);

  const cartReminder =
    cartItems.length > 0
      ? `Reminder for ${user.email}: You have ${cartItems.length} item(s) waiting in your Kroger cart.`
      : null;

  return NextResponse.json({
    authenticated: true,
    user: {
      ...user,
      krogerConnected,
    },
    krogerConnected,
    cartItems,
    cartReminder,
  });
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(USER_SESSION_COOKIE)?.value;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });
    }

    const body = await request.json();
    const { locationId, name, chain } = body;
    if (!locationId) {
      return NextResponse.json({ success: false, error: 'locationId is required' }, { status: 400 });
    }

    const updatedUser = await updateUserPreferredStore(userId, { locationId, name, chain });
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(USER_SESSION_COOKIE);
  response.cookies.delete(KROGER_TOKEN_COOKIE);
  return response;
}

