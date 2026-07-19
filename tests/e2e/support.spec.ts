import { test, expect } from './fixtures/auth';
import {
  createAdminClient,
  deleteExactRows,
  getApprovedTestUser,
} from '../../scripts/fixture-utils.mjs';

test.describe('Support Flow', () => {
  test('submit support ticket', async ({ page, balancedUser }) => {
    const admin = createAdminClient();
    const user = await getApprovedTestUser(admin, balancedUser.email);
    const marker = `Stage 7 support test ${crypto.randomUUID()}`;

    try {
      await page.goto('/login');
      await page.fill('input[name="email"]', balancedUser.email);
      await page.fill('input[name="password"]', balancedUser.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard');

      await page.goto('/support');

      await page.fill('textarea', marker);
      await page.click('button:has-text("Send message")');

      await expect(page.locator("text=Thanks, we've got it")).toBeVisible({ timeout: 10000 });
    } finally {
      const { data: tickets, error } = await admin
        .from('support_tickets')
        .select('id')
        .eq('profile_id', user.id)
        .eq('message', marker);
      expect(error).toBeNull();
      await deleteExactRows(admin, 'support_tickets', tickets?.map((ticket) => ticket.id) ?? []);
    }
  });
});
