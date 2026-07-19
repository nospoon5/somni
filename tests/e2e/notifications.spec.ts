import { test, expect } from './fixtures/auth';
import {
  createAdminClient,
  deleteExactRows,
  getApprovedTestUser,
} from '../../scripts/fixture-utils.mjs';

test.describe('Notifications', () => {
  test('in-app notification appears and can be marked read', async ({ page, balancedUser }) => {
    const admin = createAdminClient();
    const user = await getApprovedTestUser(admin, balancedUser.email);

    const { data: notification, error: insertError } = await admin.from('notification_logs').insert({
      profile_id: user.id,
      title: 'Test Deep Link',
      body: 'Click me to go to chat',
      is_read: false,
      idempotency_key: `stage7-notification-${crypto.randomUUID()}`,
    }).select('id').single();
    expect(insertError).toBeNull();
    expect(notification).toBeTruthy();

    try {
      await page.goto('/login');
      await page.fill('input[name="email"]', balancedUser.email);
      await page.fill('input[name="password"]', balancedUser.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard');
      await page.getByRole('button', { name: /notifications/i }).click();
      await expect(page.getByText('Test Deep Link')).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Mark all as read' }).click();
      await expect(page.getByRole('button', { name: /^Notifications$/ })).toBeVisible();
    } finally {
      if (notification?.id) {
        await deleteExactRows(admin, 'notification_logs', [notification.id]);
      }
    }
  });
});
