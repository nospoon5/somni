import { test, expect } from './fixtures/auth';
import { login, selectActiveBaby } from './helpers';
import {
  createAdminClient,
  deleteExactRows,
  getOwnedBabyFixture,
} from '../../scripts/fixture-utils.mjs';

test.describe('Sleep Tracking', () => {
  test('concurrent sleep completion is idempotent', async ({ browser, balancedUser, gentleUser }) => {
    const admin = createAdminClient();
    const ownerFixture = await getOwnedBabyFixture(admin, balancedUser.email);
    const caregiverFixture = await getOwnedBabyFixture(admin, gentleUser.email);
    const ownerContext = await browser.newContext();
    const caregiverContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const caregiverPage = await caregiverContext.newPage();
    let shareId: string | null = null;
    let createdLogIds: string[] = [];
    let createdNotificationIds: string[] = [];

    const { data: existingShares, error: existingShareError } = await admin
      .from('baby_shares')
      .select('id')
      .eq('baby_id', ownerFixture.baby.id)
      .eq('email', gentleUser.email);
    expect(existingShareError).toBeNull();
    expect(existingShares).toEqual([]);

    const { data: beforeLogs, error: beforeLogsError } = await admin
      .from('sleep_logs')
      .select('id')
      .eq('baby_id', ownerFixture.baby.id);
    expect(beforeLogsError).toBeNull();
    const beforeLogIds = new Set(beforeLogs?.map((row) => row.id) ?? []);

    const participantIds = [ownerFixture.user.id, caregiverFixture.user.id];
    const { data: beforeNotifications, error: beforeNotificationsError } = await admin
      .from('notification_logs')
      .select('id')
      .in('profile_id', participantIds);
    expect(beforeNotificationsError).toBeNull();
    const beforeNotificationIds = new Set(beforeNotifications?.map((row) => row.id) ?? []);

    try {
      const { data: share, error: shareError } = await admin
        .from('baby_shares')
        .insert({
          baby_id: ownerFixture.baby.id,
          email: gentleUser.email,
          access_role: 'caregiver',
          status: 'accepted',
          profile_id: caregiverFixture.user.id,
        })
        .select('id')
        .single();
      expect(shareError).toBeNull();
      expect(share).toBeTruthy();
      shareId = share!.id;

      await login(ownerPage, balancedUser);
      await login(caregiverPage, gentleUser);
      await selectActiveBaby(caregiverPage, ownerFixture.baby.name);

      await ownerPage.goto('/sleep');
      await ownerPage.getByRole('button', { name: 'Start sleep' }).click();
      await expect(ownerPage.getByRole('button', { name: 'End sleep' })).toBeVisible({ timeout: 10000 });

      await caregiverPage.goto('/sleep');
      await expect(caregiverPage.getByRole('button', { name: 'End sleep' })).toBeVisible({ timeout: 10000 });

      await Promise.all([
        ownerPage.getByRole('button', { name: 'End sleep' }).click(),
        caregiverPage.getByRole('button', { name: 'End sleep' }).click(),
      ]);

      await expect(ownerPage.getByRole('button', { name: 'Start sleep' })).toBeVisible({ timeout: 10000 });
      await expect(caregiverPage.getByRole('button', { name: 'Start sleep' })).toBeVisible({ timeout: 10000 });

      const { data: afterLogs, error: afterLogsError } = await admin
        .from('sleep_logs')
        .select('id, ended_at')
        .eq('baby_id', ownerFixture.baby.id);
      expect(afterLogsError).toBeNull();
      const createdLogs = (afterLogs ?? []).filter((row) => !beforeLogIds.has(row.id));
      createdLogIds = createdLogs.map((row) => row.id);
      expect(createdLogs).toHaveLength(1);
      expect(createdLogs[0].ended_at).not.toBeNull();
    } finally {
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
