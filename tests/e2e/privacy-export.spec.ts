import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures/auth';
import { login } from './helpers';

test.describe('Privacy export', () => {
  test('downloads a complete allowlisted export without operational secrets', async ({
    browser,
    gentleUser,
  }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    try {
      await login(page, gentleUser);
      await page.goto('/profile');

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export My Data (JSON)' }).click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();

      const exportData = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
        schemaVersion?: unknown;
        account?: {
          auth?: { email?: unknown };
          messages?: unknown;
          support_tickets?: unknown;
          notifications?: unknown;
          registered_devices?: unknown;
          shares?: unknown;
        };
        owned_babies?: unknown;
        shared_family_contributions?: unknown;
      };

      expect(exportData.schemaVersion).toBe(1);
      expect(exportData.account?.auth?.email).toBe(gentleUser.email);
      expect(exportData.account).toMatchObject({
        messages: expect.any(Array),
        support_tickets: expect.any(Array),
        notifications: expect.any(Array),
        registered_devices: expect.any(Array),
        shares: expect.any(Object),
      });
      expect(exportData.owned_babies).toEqual(expect.any(Array));
      expect(exportData.shared_family_contributions).toEqual(expect.any(Object));

      const serialized = JSON.stringify(exportData);
      for (const forbiddenField of [
        'stripe_customer_id',
        'stripe_subscription_id',
        'invite_token_hash',
        'p256dh',
        'service_role',
        'refresh_token',
        'access_token',
      ]) {
        expect(serialized).not.toContain(forbiddenField);
      }
    } finally {
      await context.close();
    }
  });
});
