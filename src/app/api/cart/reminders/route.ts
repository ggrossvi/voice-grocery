/**
 * Cart Abandonment & Reminder API Route
 *
 * Route: GET & POST /api/cart/reminders
 * Uses the Google Sign-In `userId` and `email` stored in the database to find
 * users who still have unchecked-out items in their Kroger cart and remind them.
 */

import { NextResponse } from 'next/server';
import { getUsersNeedingCartReminders, markUserCartReminded } from '@/lib/auth';

// GET /api/cart/reminders - Lists all users with items waiting in their cart
export async function GET() {
  const reminders = await getUsersNeedingCartReminders();
  return NextResponse.json({
    success: true,
    count: reminders.length,
    reminders,
  });
}

// POST /api/cart/reminders - Triggers reminders and records `lastCartRemindedAt` for each user
export async function POST(request: Request) {
  let targetUserId: string | undefined;
  try {
    const body = await request.json();
    targetUserId = body?.userId;
  } catch {
    // Optional body
  }

  const reminders = await getUsersNeedingCartReminders();
  const filtered = targetUserId
    ? reminders.filter(r => r.userId === targetUserId)
    : reminders;

  for (const reminder of filtered) {
    await markUserCartReminded(reminder.userId);
  }

  return NextResponse.json({
    success: true,
    remindedCount: filtered.length,
    reminders: filtered,
  });
}

