import { test, expect } from './fixtures/auth';
import { login, selectActiveBaby } from './helpers';
import {
  createAdminClient,
  deleteExactRows,
  getOwnedBabyFixture,
} from '../../scripts/fixture-utils.mjs';

test.describe('UI and Server Action Permissions', () => {
  test('revoked caregiver cannot act on a stale shared-baby page', async ({ browser, balancedUser, gentleUser }) => {
    const admin = createAdminClient();
    const ownerFixture = await getOwnedBabyFixture(admin, balancedUser.email);
    const caregiverFixture = await getOwnedBabyFixture(admin, gentleUser.email);
    const context = await browser.newContext();
    const page = await context.newPage();
    let shareId: string | null = null;

    const { data: beforeSharedLogs, error: beforeSharedLogsError } = await admin
      .from('sleep_logs')
      .select('id')
      .eq('baby_id', ownerFixture.baby.id);
    expect(beforeSharedLogsError).toBeNull();
    const beforeSharedLogIds = new Set(beforeSharedLogs?.map((row) => row.id) ?? []);
    const { data: beforeCaregiverLogs, error: beforeCaregiverLogsError } = await admin
      .from('sleep_logs')
      .select('id')
      .eq('baby_id', caregiverFixture.baby.id);
    expect(beforeCaregiverLogsError).toBeNull();
    const beforeCaregiverLogIds = new Set(beforeCaregiverLogs?.map((row) => row.id) ?? []);

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

      await login(page, gentleUser);
      await selectActiveBaby(page, ownerFixture.baby.name);
      await expect
        .poll(async () => {
          const selected = (await context.cookies()).find(
            (cookie) => cookie.name === 'somni_active_baby',
          );
          return selected?.value;
        })
        .toBe(ownerFixture.baby.id);
      await page.goto('/sleep');
      await expect(page.getByRole('button', { name: 'Start sleep' })).toBeVisible();

      await deleteExactRows(admin, 'baby_shares', [shareId]);
      shareId = null;

      await page.getByRole('button', { name: 'Start sleep' }).click();
      await expect(page.getByText('You no longer have access to this baby.')).toBeVisible({ timeout: 10000 });

      const { data: afterSharedLogs, error: afterSharedLogsError } = await admin
        .from('sleep_logs')
        .select('id')
        .eq('baby_id', ownerFixture.baby.id);
      expect(afterSharedLogsError).toBeNull();
      expect((afterSharedLogs ?? []).filter((row) => !beforeSharedLogIds.has(row.id))).toEqual([]);

      await page.reload();
      await expect(page.getByText(ownerFixture.baby.name, { exact: false })).not.toBeVisible();
    } finally {
      if (shareId) await deleteExactRows(admin, 'baby_shares', [shareId]);
      for (const [babyId, baselineIds] of [
        [ownerFixture.baby.id, beforeSharedLogIds],
        [caregiverFixture.baby.id, beforeCaregiverLogIds],
      ] as const) {
        const { data: currentLogs, error: currentLogsError } = await admin
          .from('sleep_logs')
          .select('id')
          .eq('baby_id', babyId);
        expect(currentLogsError).toBeNull();
        await deleteExactRows(
          admin,
          'sleep_logs',
          (currentLogs ?? [])
            .map((row) => row.id)
            .filter((id) => !baselineIds.has(id)),
        );
      }
      await context.close();
    }
  });

  test('a caregiver account cannot see another account billing identity', async ({ browser, gentleUser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, gentleUser);
      await page.goto('/billing');
      await expect(page.getByText('Plan and subscription')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('balancedtester@test.com')).not.toBeVisible();
    } finally {
      await context.close();
    }
  });
});
