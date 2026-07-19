import { test, expect } from './fixtures/auth';
import {
  createAdminClient,
  deleteExactRows,
  getOwnedBabyFixture,
} from '../../scripts/fixture-utils.mjs';

test.describe('Invitations', () => {
  test('send and accept baby share invitation', async ({ browser, balancedUser, gentleUser }) => {
    const admin = createAdminClient();
    const { baby } = await getOwnedBabyFixture(admin, balancedUser.email);
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    let createdShareId: string | null = null;

    const { data: existingShares, error: existingShareError } = await admin
      .from('baby_shares')
      .select('id')
      .eq('baby_id', baby.id)
      .eq('email', gentleUser.email);
    expect(existingShareError).toBeNull();
    expect(existingShares).toEqual([]);

    const caregiverContext = await browser.newContext();
    const caregiverPage = await caregiverContext.newPage();

    try {
      await ownerPage.goto('/login');
      await ownerPage.fill('input[name="email"]', balancedUser.email);
      await ownerPage.fill('input[name="password"]', balancedUser.password);
      await ownerPage.click('button[type="submit"]');
      await expect(ownerPage).toHaveURL('/dashboard');

      await ownerPage.goto('/profile');
      await ownerPage.fill('input[name="email"]', gentleUser.email);
      await ownerPage.click('button:has-text("Send invitation")');
      await expect(ownerPage.locator('text=Invitation link generated:')).toBeVisible({ timeout: 10000 });

      const linkLocator = ownerPage.locator('p.text-body', { hasText: '/invite/accept?id=' });
      await linkLocator.waitFor({ state: 'visible', timeout: 5000 });
      const fullUrl = await linkLocator.textContent();
      expect(fullUrl).toBeTruthy();
      const urlObj = new URL(fullUrl!);
      createdShareId = urlObj.searchParams.get('id');
      expect(createdShareId).toMatch(/^[0-9a-f-]{36}$/i);
      const acceptUrl = urlObj.pathname + urlObj.search;

      await caregiverPage.goto('/login');
      await caregiverPage.fill('input[name="email"]', gentleUser.email);
      await caregiverPage.fill('input[name="password"]', gentleUser.password);
      await caregiverPage.click('button[type="submit"]');
      await expect(caregiverPage).toHaveURL('/dashboard');

      await caregiverPage.goto(acceptUrl);
      await caregiverPage.click('button:has-text("Accept Invitation")');
      await expect(caregiverPage).toHaveURL('/dashboard');
      await expect(caregiverPage.getByLabel('Active baby')).toHaveValue(baby.id);
    } finally {
      if (createdShareId) {
        await deleteExactRows(admin, 'baby_shares', [createdShareId]);
      }
      await ownerContext.close();
      await caregiverContext.close();
    }
  });
});
