import { describe, it, expect } from 'vitest';
import {
  upsertGoogleUser,
  getUserById,
  linkKrogerAccountToUser,
  getValidKrogerTokenForUser,
  recordUserCartItem,
  getUsersNeedingCartReminders,
  markUserCartReminded,
} from '@/lib/auth';

describe('Google Sign-In, Kroger Linking & Cart Reminders', () => {
  const testGoogleId = `google-sub-${Date.now()}`;
  const testEmail = `shopper-${Date.now()}@gmail.com`;

  it('stores the Google Sign-In ID as userId along with email', async () => {
    const user = await upsertGoogleUser({
      googleId: testGoogleId,
      email: testEmail,
      name: 'Test Shopper',
    });

    expect(user.id).toBe(testGoogleId);
    expect(user.email).toBe(testEmail);
    expect(user.krogerConnected).toBe(false);

    const fetched = await getUserById(testGoogleId);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(testGoogleId);
    expect(fetched?.email).toBe(testEmail);
  });

  it('links a Kroger OAuth account to the Google user ID', async () => {
    const updated = await linkKrogerAccountToUser(testGoogleId, {
      accessToken: 'sandbox_kroger_access_123',
      refreshToken: 'sandbox_kroger_refresh_456',
      expiresIn: 1800,
    });

    expect(updated).not.toBeNull();
    expect(updated?.krogerConnected).toBe(true);

    const token = await getValidKrogerTokenForUser(testGoogleId);
    expect(token).toBe('sandbox_kroger_access_123');
  });

  it('tracks cart items per Google userId and generates email cart reminders', async () => {
    const cartEntry = await recordUserCartItem(
      testGoogleId,
      {
        upc: '0001111041600',
        description: 'Kroger® Vitamin D Whole Milk',
        brand: 'Kroger',
        size: '1 gal',
        price: 3.29,
      },
      1,
      'PICKUP'
    );

    expect(cartEntry.upc).toBe('0001111041600');

    const reminders = await getUsersNeedingCartReminders();
    const userReminder = reminders.find(r => r.userId === testGoogleId);

    expect(userReminder).toBeDefined();
    expect(userReminder?.email).toBe(testEmail);
    expect(userReminder?.itemCount).toBeGreaterThanOrEqual(1);
    expect(userReminder?.reminderMessage).toContain('Kroger® Vitamin D Whole Milk');

    await markUserCartReminded(testGoogleId);
    const refreshedUser = await getUserById(testGoogleId);
    expect(refreshedUser?.lastCartRemindedAt).toBeDefined();
  });
});

