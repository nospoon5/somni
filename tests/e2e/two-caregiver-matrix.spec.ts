import { test, expect } from './fixtures/auth';
import { login } from './helpers';
import {
  createAdminClient,
  deleteExactRows,
  getOwnedBabyFixture,
} from '../../scripts/fixture-utils.mjs';

test.describe('Two-Caregiver Matrix', () => {
  test('invite, handoff timeline, and revocation', async ({ browser, balancedUser, gentleUser }) => {
    const admin = createAdminClient();
    const ownerFixture = await getOwnedBabyFixture(admin, balancedUser.email);
    const ownerContext = await browser.newContext();
    const caregiverContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const caregiverPage = await caregiverContext.newPage();
    let shareId: string | null = null;
    let createdLogIds: string[] = [];
    let createdNotificationIds: string[] = [];

    const { data: caregiverFixture } = await admin
      .from('profiles')
      .select('id')
      .eq('email', gentleUser.email)
      .single();
    expect(caregiverFixture).toBeTruthy();

    const { data: existingShares, error: existingShareError } = await admin
      .from('baby_shares')
      .select('id')
      .eq('baby_id', ownerFixture.baby.id)
      .eq('email', gentleUser.email);
    expect(existingShareError).toBeNull();
    expect(existingShares).toEqual([]);

    const { data: beforeLogs } = await admin
      .from('sleep_logs')
      .select('id')
      .eq('baby_id', ownerFixture.baby.id);
    const beforeLogIds = new Set(beforeLogs?.map((row) => row.id) ?? []);
    const participantIds = [ownerFixture.user.id, caregiverFixture!.id];
    const { data: beforeNotifications } = await admin
      .from('notification_logs')
      .select('id')
      .in('profile_id', participantIds);
    const beforeNotificationIds = new Set(beforeNotifications?.map((row) => row.id) ?? []);

    try {
      await login(ownerPage, balancedUser);
      await login(caregiverPage, gentleUser);

      await ownerPage.goto('/profile');
      await ownerPage.fill('input[name="email"]', gentleUser.email);
      await ownerPage.getByRole('button', { name: 'Send invitation' }).click();
      const linkLocator = ownerPage.locator('p.text-body', { hasText: '/invite/accept?id=' });
      await expect(linkLocator).toBeVisible({ timeout: 10000 });
      const fullUrl = await linkLocator.textContent();
      expect(fullUrl).toBeTruthy();
      const url = new URL(fullUrl!);
      shareId = url.searchParams.get('id');
      expect(shareId).toMatch(/^[0-9a-f-]{36}$/i);

      await caregiverPage.goto(`${url.pathname}${url.search}`);
      await caregiverPage.getByRole('button', { name: 'Accept Invitation' }).click();
      await expect(caregiverPage).toHaveURL('/dashboard');
      await expect(caregiverPage.getByLabel('Active baby')).toHaveValue(ownerFixture.baby.id);

      await ownerPage.goto('/sleep');
      await ownerPage.getByRole('button', { name: 'Start sleep' }).click();
      await expect(ownerPage.getByRole('button', { name: 'End sleep' })).toBeVisible();

      await caregiverPage.goto('/sleep');
      await expect(caregiverPage.getByRole('button', { name: 'End sleep' })).toBeVisible();
      await caregiverPage.getByRole('button', { name: 'End sleep' }).click();
      await expect(caregiverPage.getByRole('button', { name: 'Start sleep' })).toBeVisible();

      await expect.poll(async () => {
        const { data: currentNotifications, error: notificationError } = await admin
          .from('notification_logs')
          .select('id')
          .in('profile_id', participantIds);
        expect(notificationError).toBeNull();
        return (currentNotifications ?? []).filter(
          (row) => !beforeNotificationIds.has(row.id),
        ).length;
      }).toBe(2);

      await ownerPage.goto('/dashboard');
      await expect(ownerPage.getByText('Recent Activity')).toBeVisible();
      await expect(ownerPage.getByRole('listitem').filter({ hasText: 'Started' }).first()).toBeVisible();
      await expect(ownerPage.getByRole('listitem').filter({ hasText: 'Ended' }).first()).toBeVisible();

      await ownerPage.goto('/profile');
      await ownerPage
        .locator('div')
        .filter({ hasText: gentleUser.email })
        .getByRole('button', { name: 'Remove access' })
        .first()
        .click();
      shareId = null;
      await expect(ownerPage.getByText(gentleUser.email)).not.toBeVisible();

      await caregiverPage.goto('/dashboard');
      await expect(caregiverPage.getByText(ownerFixture.baby.name, { exact: false })).not.toBeVisible();
    } finally {
      const { data: afterLogs } = await admin
        .from('sleep_logs')
        .select('id')
        .eq('baby_id', ownerFixture.baby.id);
      createdLogIds = (afterLogs ?? [])
        .filter((row) => !beforeLogIds.has(row.id))
        .map((row) => row.id);
      const { data: afterNotifications } = await admin
        .from('notification_logs')
        .select('id')
        .in('profile_id', participantIds);
      createdNotificationIds = (afterNotifications ?? [])
        .filter((row) => !beforeNotificationIds.has(row.id))
        .map((row) => row.id);

      await deleteExactRows(admin, 'sleep_logs', createdLogIds);
      await deleteExactRows(admin, 'notification_logs', createdNotificationIds);
      if (shareId) await deleteExactRows(admin, 'baby_shares', [shareId]);
      await ownerContext.close();
      await caregiverContext.close();
    }
  });
});
