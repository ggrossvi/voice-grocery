import { describe, it, expect, afterAll } from 'vitest';
import {
  upsertGoogleUser,
  getUserById,
  updateUserPreferredStore,
  linkKrogerAccountToUser,
  getValidKrogerTokenForUser,
  recordUserCartItem,
  getUserActiveCartItems,
  getUsersNeedingCartReminders,
  markUserCartReminded,
  removeTestData,
} from '@/lib/auth';

describe('Google Sign-In, Kroger Linking & Cart Reminders', () => {
  const testGoogleId = `google-sub-${Date.now()}`;
  const testEmail = `shopper-${Date.now()}@gmail.com`;

  afterAll(async () => {
    await removeTestData(testGoogleId);
  });

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

  it('persists the user preferred Home Store (ID, name, chain)', async () => {
    const updated = await updateUserPreferredStore(testGoogleId, {
      locationId: '70500872',
      name: 'University Village QFC',
      chain: 'QFC',
    });

    expect(updated).not.toBeNull();
    expect(updated?.preferredStoreId).toBe('70500872');
    expect(updated?.preferredStoreName).toBe('University Village QFC');
    expect(updated?.preferredStoreChain).toBe('QFC');
  });

  it('removes test user and associated cart items via removeTestData()', async () => {
    await removeTestData(testGoogleId);

    const deletedUser = await getUserById(testGoogleId);
    expect(deletedUser).toBeNull();

    const remainingCartItems = await getUserActiveCartItems(testGoogleId);
    expect(remainingCartItems).toEqual([]);
  });
});

