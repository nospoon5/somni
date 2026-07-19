import { createHash } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { test, expect } from './fixtures/auth';
import {
  createAdminClient,
  deleteExactRows,
  getOwnedBabyFixture,
} from '../../scripts/fixture-utils.mjs';

function createAuthenticatedTestClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing linked Supabase test configuration');
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.describe('Authorization attack regression', () => {
  test('invite token and permanent baby ownership resist direct client tampering', async ({
    balancedUser,
    gentleUser,
  }) => {
    const admin = createAdminClient();
    const ownerFixture = await getOwnedBabyFixture(admin, balancedUser.email);
    const caregiverFixture = await getOwnedBabyFixture(admin, gentleUser.email);
    const ownerClient = createAuthenticatedTestClient();
    const caregiverClient = createAuthenticatedTestClient();
    const rawToken = 'a'.repeat(64);
    let shareId: string | null = null;
    const sleepLogIds: string[] = [];

    try {
      const ownerLogin = await ownerClient.auth.signInWithPassword(balancedUser);
      const caregiverLogin = await caregiverClient.auth.signInWithPassword(gentleUser);
      expect(ownerLogin.error).toBeNull();
      expect(caregiverLogin.error).toBeNull();

      const { data: share, error: insertError } = await ownerClient
        .from('baby_shares')
        .insert({
          baby_id: ownerFixture.baby.id,
          email: gentleUser.email,
          access_role: 'caregiver',
          status: 'pending',
          profile_id: caregiverFixture.user.id,
          invite_token_hash: createHash('sha256').update(rawToken).digest('hex'),
          invite_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();
      expect(insertError).toBeNull();
      expect(share).toBeTruthy();
      shareId = share!.id;

      const directUpdate = await caregiverClient
        .from('baby_shares')
        .update({ status: 'accepted', profile_id: caregiverFixture.user.id })
        .eq('id', shareId);
      expect(directUpdate.error).toBeTruthy();

      const wrongToken = await caregiverClient.rpc('accept_baby_invite', {
        p_share_id: shareId,
        p_raw_token: 'b'.repeat(64),
      });
      expect(wrongToken.error).toBeTruthy();

      const { data: stillPending, error: pendingReadError } = await admin
        .from('baby_shares')
        .select('status, invite_token_hash')
        .eq('id', shareId)
        .single();
      expect(pendingReadError).toBeNull();
      expect(stillPending?.status).toBe('pending');
      expect(stillPending?.invite_token_hash).toHaveLength(64);

      const accepted = await caregiverClient.rpc('accept_baby_invite', {
        p_share_id: shareId,
        p_raw_token: rawToken,
      });
      expect(accepted.error).toBeNull();
      expect(accepted.data).toBe(ownerFixture.baby.id);

      const ownershipAttack = await caregiverClient
        .from('babies')
        .update({ profile_id: caregiverFixture.user.id })
        .eq('id', ownerFixture.baby.id);
      expect(ownershipAttack.error).toBeTruthy();

      const { data: protectedBaby, error: protectedBabyError } = await admin
        .from('babies')
        .select('profile_id')
        .eq('id', ownerFixture.baby.id)
        .single();
      expect(protectedBabyError).toBeNull();
      expect(protectedBaby?.profile_id).toBe(ownerFixture.user.id);

      const recentStartedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentEndedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const forgedAttribution = await caregiverClient
        .from('sleep_logs')
        .insert({
          baby_id: ownerFixture.baby.id,
          started_at: recentStartedAt,
          ended_at: recentEndedAt,
          is_night: false,
          tags: ['stage7-attribution-check'],
          logged_by: ownerFixture.user.id,
        })
        .select('id, logged_by')
        .single();
      expect(forgedAttribution.error).toBeNull();
      expect(forgedAttribution.data?.logged_by).toBe(caregiverFixture.user.id);
      sleepLogIds.push(forgedAttribution.data!.id);

      const changeAttribution = await caregiverClient
        .from('sleep_logs')
        .update({ logged_by: ownerFixture.user.id })
        .eq('id', forgedAttribution.data!.id)
        .select('logged_by')
        .single();
      expect(changeAttribution.error).toBeNull();
      expect(changeAttribution.data?.logged_by).toBe(caregiverFixture.user.id);

      const oldStartedAt = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const oldEndedAt = new Date(Date.now() - 71 * 60 * 60 * 1000).toISOString();
      const { data: oldLog, error: oldLogError } = await admin
        .from('sleep_logs')
        .insert({
          baby_id: ownerFixture.baby.id,
          started_at: oldStartedAt,
          ended_at: oldEndedAt,
          is_night: false,
          tags: ['stage7-history-check'],
          logged_by: caregiverFixture.user.id,
        })
        .select('id')
        .single();
      expect(oldLogError).toBeNull();
      sleepLogIds.push(oldLog!.id);

      const oldHistoryAttack = await caregiverClient
        .from('sleep_logs')
        .update({ notes: 'should not be accepted' })
        .eq('id', oldLog!.id)
        .select('id');
      expect(oldHistoryAttack.error).toBeNull();
      expect(oldHistoryAttack.data).toHaveLength(0);
    } finally {
      await deleteExactRows(admin, 'sleep_logs', sleepLogIds);
      if (shareId) await deleteExactRows(admin, 'baby_shares', [shareId]);
      await Promise.all([ownerClient.auth.signOut(), caregiverClient.auth.signOut()]);
    }
  });
});
