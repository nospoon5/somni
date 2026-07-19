'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { setActiveBabyId } from '@/lib/babies/active-baby'
import { compileAccountDataExport } from '@/lib/privacy/account-data'
import { deleteAccountAndData } from '@/lib/privacy/account-deletion'
import { createRequestLogger } from '@/lib/observability/logger'
import { createInitialSleepPlanProfile } from '@/lib/sleep-plan-profile-init'
import type {
  OnboardingDayStructure,
  OnboardingNapPattern,
  OnboardingSchedulePreference,
} from '@/lib/onboarding-preferences'

export type InviteActionState = {
  error?: string
  success?: string
  inviteLink?: string
}

export type NotificationPreferencesInput = {
  pushEnabled: boolean
  inAppFeedEnabled: boolean
  nightSuppressionEnabled: boolean
  suppressionStart: string
  suppressionEnd: string
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export async function updateNotificationPreferencesAction(
  input: NotificationPreferencesInput
): Promise<{ error?: string }> {
  if (
    typeof input?.pushEnabled !== 'boolean' ||
    typeof input.inAppFeedEnabled !== 'boolean' ||
    typeof input.nightSuppressionEnabled !== 'boolean' ||
    !TIME_PATTERN.test(input.suppressionStart) ||
    !TIME_PATTERN.test(input.suppressionEnd)
  ) {
    return { error: 'Please use valid notification settings.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Please sign in again to update notifications.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      push_enabled: input.pushEnabled,
      in_app_feed_enabled: input.inAppFeedEnabled,
      night_suppression_enabled: input.nightSuppressionEnabled,
      suppression_start: input.suppressionStart,
      suppression_end: input.suppressionEnd,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[profile] failed to update notification preferences', error)
    return { error: 'Could not save your notification settings. Please try again.' }
  }

  revalidatePath('/profile')
  return {}
}

export async function inviteCaregiverAction(
  _prevState: InviteActionState,
  formData: FormData
): Promise<InviteActionState> {
  const babyId = formData.get('babyId') as string
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!babyId || !email) {
    return { error: 'Please provide a valid email address.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized.' }
  }

  // 1. Verify user owns the baby profile
  const { data: baby, error: babyError } = await supabase
    .from('babies')
    .select('id, profile_id')
    .eq('id', babyId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (babyError || !baby) {
    return { error: 'You must be the owner of this baby profile to invite caregivers.' }
  }

  if (user.email && user.email.toLowerCase() === email) {
    return { error: 'You cannot invite yourself as a caregiver.' }
  }

  // 2. Check if invite already exists
  const { data: existingShare } = await supabase
    .from('baby_shares')
    .select('id, status')
    .eq('baby_id', babyId)
    .eq('email', email)
    .maybeSingle()

  if (existingShare) {
    if (existingShare.status === 'accepted') {
      return { error: 'This caregiver has already accepted the invitation.' }
    }
    return { error: 'An invitation has already been sent to this email.' }
  }

  // 3. Auto-link to existing profile if email is registered
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // 4. Create the baby_shares entry
  const { data: newShare, error: insertError } = await supabase
    .from('baby_shares')
    .insert({
      baby_id: babyId,
      email,
      access_role: 'caregiver',
      status: 'pending',
      profile_id: existingProfile?.id ?? undefined,
      invite_token_hash: tokenHash,
      invite_expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (insertError || !newShare) {
    console.error('[invite] failed to insert share', insertError)
    return { error: 'Failed to create invitation. Please try again.' }
  }

  revalidatePath('/profile')
  return {
    success: `Invitation sent successfully to ${email}.`,
    inviteLink: `/invite/accept?id=${newShare.id}&token=${rawToken}`
  }
}

export async function rotateInviteTokenAction(
  _prevState: InviteActionState,
  formData: FormData
): Promise<InviteActionState> {
  const babyId = formData.get('babyId') as string
  const shareId = formData.get('shareId') as string

  if (!babyId || !shareId) {
    return { error: 'Invalid invitation state.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized.' }
  }

  // Verify ownership of the baby
  const { data: baby, error: babyError } = await supabase
    .from('babies')
    .select('id')
    .eq('id', babyId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (babyError || !baby) {
    return { error: 'Unauthorized.' }
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const { data: rotatedExpiry, error: updateError } = await supabase.rpc(
    'rotate_baby_invite',
    {
      p_share_id: shareId,
      p_raw_token: rawToken,
    }
  )

  if (updateError || !rotatedExpiry) {
    console.error('[invite] failed to rotate token', updateError)
    return { error: 'Failed to generate new invitation link.' }
  }

  revalidatePath('/profile')
  return {
    success: 'New invitation link generated successfully.',
    inviteLink: `/invite/accept?id=${shareId}&token=${rawToken}`
  }
}

export async function revokeCaregiverAction(
  _prevState: InviteActionState,
  formData: FormData
): Promise<InviteActionState> {
  const babyId = formData.get('babyId') as string
  const shareId = formData.get('shareId') as string

  if (!babyId || !shareId) {
    return { error: 'Invalid invitation state.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized.' }
  }

  // Verify ownership of the baby
  const { data: baby, error: babyError } = await supabase
    .from('babies')
    .select('id')
    .eq('id', babyId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (babyError || !baby) {
    return { error: 'Unauthorized.' }
  }

  const { error: deleteError } = await supabase
    .from('baby_shares')
    .delete()
    .eq('id', shareId)
    .eq('baby_id', babyId)

  if (deleteError) {
    console.error('[invite] failed to delete share', deleteError)
    return { error: 'Failed to revoke invitation.' }
  }

  revalidatePath('/profile')
  return { success: 'Caregiver access revoked successfully.' }
}

export async function acceptInviteAction(
  formData: FormData
): Promise<void> {
  const shareId = formData.get('shareId') as string
  const token = formData.get('token') as string

  if (!shareId || !token) {
    throw new Error('Invalid invitation link.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('You must be signed in to accept an invitation.')
  }

  const { data: sharedBabyId, error: acceptError } = await supabase.rpc(
    'accept_baby_invite',
    {
      p_share_id: shareId,
      p_raw_token: token,
    }
  )

  if (acceptError || !sharedBabyId) {
    console.error('[invite] atomic acceptance failed', acceptError)
    throw new Error('This invitation is invalid, expired, already used, or intended for another account.')
  }

  // Only write when onboarding is genuinely incomplete. Re-acceptance by an existing
  // account must not churn profile.updated_at or leave test/user-state residue.
  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)
    .eq('onboarding_completed', false)

  if (profileUpdateError) {
    console.error('[invite] failed to update profile onboarding status', profileUpdateError)
  }

  await setActiveBabyId(sharedBabyId)

  revalidatePath('/dashboard')
  revalidatePath('/profile')

  redirect('/dashboard')
}

export async function updateBabyAndSleepSettingsAction(
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const babyId = formData.get('babyId') as string
  const babyName = (formData.get('babyName') as string)?.trim()
  const dateOfBirth = formData.get('dateOfBirth') as string
  const biggestIssue = formData.get('biggestIssue') as string
  const feedingType = formData.get('feedingType') as string
  const bedtimeRange = formData.get('bedtimeRange') as string

  const typicalWakeTime = formData.get('typicalWakeTime') as string
  const dayStructure = formData.get('dayStructure') as OnboardingDayStructure
  const napPattern = formData.get('napPattern') as OnboardingNapPattern
  const nightFeedsStr = formData.get('nightFeeds') as string
  const schedulePreference = formData.get('schedulePreference') as OnboardingSchedulePreference

  if (!babyId || !babyName || !dateOfBirth) {
    return { error: 'Please fill in all baby details.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to change settings.' }
  }

  // 1. Verify access/ownership
  const { data: baby, error: babyError } = await supabase
    .from('babies')
    .select('id, profile_id')
    .eq('id', babyId)
    .maybeSingle()

  if (babyError || !baby) {
    return { error: 'Baby profile not found.' }
  }

  // Verify user is owner or has caregiver share
  if (baby.profile_id !== user.id) {
    const { data: share } = await supabase
      .from('baby_shares')
      .select('id')
      .eq('baby_id', babyId)
      .eq('profile_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle()

    if (!share) {
      return { error: 'You do not have permission to update settings for this baby.' }
    }
  }

  // 2. Update babies details
  const { error: updateBabyError } = await supabase
    .from('babies')
    .update({
      name: babyName,
      date_of_birth: dateOfBirth,
      biggest_issue: biggestIssue,
      feeding_type: feedingType,
      bedtime_range: bedtimeRange,
    })
    .eq('id', babyId)

  if (updateBabyError) {
    return { error: updateBabyError.message || 'Failed to update baby details.' }
  }

  // 3. Update onboarding preferences details
  const { error: updatePrefError } = await supabase
    .from('onboarding_preferences')
    .update({
      typical_wake_time: typicalWakeTime,
      day_structure: dayStructure,
      nap_pattern: napPattern,
      night_feeds: nightFeedsStr === 'yes' || nightFeedsStr === 'trying_to_wean',
      schedule_preference: schedulePreference,
    })
    .eq('baby_id', babyId)

  if (updatePrefError) {
    return { error: updatePrefError.message || 'Failed to update onboarding preferences.' }
  }

  // 4. Update sleep plan profile baseline parameters!
  const { data: existingProfile } = await supabase
    .from('sleep_plan_profiles')
    .select('*')
    .eq('baby_id', babyId)
    .maybeSingle()

  if (existingProfile) {
    // Generate new baseline parameters
    const seedInput = {
      id: babyId,
      name: babyName,
      dateOfBirth,
      sleepStyleLabel: ((existingProfile.wake_window_profile as { sleepStyleLabel?: string })?.sleepStyleLabel || 'balanced') as 'balanced' | 'gentle' | 'fast-track' | null,
      typicalWakeTime,
      dayStructure,
      napPattern,
      nightFeeds: nightFeedsStr === 'yes' || nightFeedsStr === 'trying_to_wean',
      schedulePreference,
    }

    const newProfileInsert = createInitialSleepPlanProfile(seedInput)

    // Update sleep plan profiles
    const { error: updateProfileError } = await supabase
      .from('sleep_plan_profiles')
      .update({
        age_band: newProfileInsert.age_band,
        template_key: newProfileInsert.template_key,
        usual_wake_time: newProfileInsert.usual_wake_time,
        target_bedtime: newProfileInsert.target_bedtime,
        target_nap_count: newProfileInsert.target_nap_count,
        wake_window_profile: newProfileInsert.wake_window_profile,
        feed_anchor_profile: newProfileInsert.feed_anchor_profile,
        schedule_preference: newProfileInsert.schedule_preference,
        day_structure: newProfileInsert.day_structure,
        last_evidence_summary: 'Updated via profile settings settings update',
      })
      .eq('baby_id', babyId)

    if (updateProfileError) {
      console.error('[profile] Failed to update sleep plan profile baseline', updateProfileError)
    }

    // Insert change event in sleep_plan_change_events
    await supabase.from('sleep_plan_change_events').insert({
      baby_id: babyId,
      change_scope: 'profile',
      change_source: 'user',
      change_kind: 'settings_update',
      summary: 'Baby profile settings and coaching preferences updated by caregiver.',
      rationale: 'User saved changes to wake time, day structure, nap counts, and schedule preferences.',
      before_snapshot: {},
      after_snapshot: {
        babyName,
        dateOfBirth,
        typicalWakeTime,
        dayStructure,
        napPattern,
        nightFeedsStr,
        schedulePreference,
      }
    })
  }

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: 'Settings updated successfully.' }
}

export async function exportUserDataAction(): Promise<{ error?: string; data?: unknown }> {
  const actionLogger = createRequestLogger({ action: 'exportUserDataAction' })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to export your data.' }
  }

  try {
    return { data: await compileAccountDataExport(user) }
  } catch (error) {
    actionLogger.error('Account data export failed', { userId: user.id }, error, true)
    return { error: 'Failed to compile your complete data export. Please try again or contact support.' }
  }
}

export async function deleteBabyProfileAndDataAction(
  babyId: string
): Promise<{ error?: string; success?: string }> {
  const actionLogger = createRequestLogger({ action: 'deleteBabyProfileAndDataAction' })
  if (!babyId) return { error: 'Invalid baby ID.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to perform this action.' }
  }

  // 1. Verify user is the actual OWNER of the baby profile
  const { data: baby, error: babyError } = await supabase
    .from('babies')
    .select('id, profile_id')
    .eq('id', babyId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (babyError || !baby) {
    return { error: 'You can only delete baby profiles that you created and own.' }
  }

  // Every baby-owned table has an ON DELETE CASCADE foreign key. Deleting the parent
  // is one atomic database statement, so a partial child-data deletion cannot occur.
  const { data: deletedBaby, error: delBabyErr } = await supabase
    .from('babies')
    .delete()
    .eq('id', babyId)
    .eq('profile_id', user.id)
    .select('id')
    .maybeSingle()

  if (delBabyErr || !deletedBaby) {
    if (delBabyErr) {
      actionLogger.error('Baby profile deletion failed', { userId: user.id, babyId }, delBabyErr, true)
    }
    return { error: 'Failed to delete baby profile. Please try again or contact support.' }
  }

  // Mark onboarding_completed to false if this was their only baby
  const { data: remainingBabies } = await supabase
    .from('babies')
    .select('id')
    .eq('profile_id', user.id)
    .limit(1)

  if (!remainingBabies || remainingBabies.length === 0) {
    await supabase.from('profiles').update({ onboarding_completed: false }).eq('id', user.id)
  }

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { success: 'Profile deleted successfully.' }
}

export async function deleteUserAccountAction(
  confirmation: string
): Promise<{ error?: string; success?: string }> {
  const actionLogger = createRequestLogger({ action: 'deleteUserAccountAction' })
  if (confirmation.trim().toUpperCase() !== 'DELETE ACCOUNT') {
    return { error: 'Please type DELETE ACCOUNT to confirm.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to perform this action.' }
  }

  try {
    await deleteAccountAndData({ userId: user.id, email: user.email })
  } catch (error) {
    actionLogger.error('Account deletion failed', { userId: user.id }, error, true)
    return { error: 'Failed to delete user account. Please try again or contact support.' }
  }

  return { success: 'Your account and all associated data have been permanently deleted.' }
}
