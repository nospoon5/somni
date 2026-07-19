import { test, expect } from './fixtures/auth';

test.describe('Navigation', () => {
  test('global navigation links', async ({ page, balancedUser }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', balancedUser.email);
    await page.fill('input[name="password"]', balancedUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    await page.click('text=Sleep');
    await expect(page).toHaveURL(/\/sleep/);

    await page.click('text=Chat');
    await expect(page).toHaveURL(/\/chat/);

    await page.click('text=Settings');
    await expect(page).toHaveURL(/\/profile/);
  });
});
