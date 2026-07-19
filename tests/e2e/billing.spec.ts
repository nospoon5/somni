import { test, expect } from './fixtures/auth';

test.describe('Billing Flow', () => {
  test('billing return page rendering', async ({ page, balancedUser }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', balancedUser.email);
    await page.fill('input[name="password"]', balancedUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    await page.goto('/billing');
    
    await expect(page.locator('text=Plan and subscription')).toBeVisible({ timeout: 10000 });
  });
});
