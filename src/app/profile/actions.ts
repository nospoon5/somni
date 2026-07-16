'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type InviteActionState = {
  error?: string
  success?: string
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
  const accessRole = (formData.get('accessRole') as string) || 'caregiver'

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

  // 4. Create the baby_shares entry
  const { error: insertError } = await supabase
    .from('baby_shares')
    .insert({
      baby_id: babyId,
      email,
      access_role: accessRole,
      status: 'pending',
      profile_id: existingProfile?.id ?? null,
    })

  if (insertError) {
    console.error('[invite] failed to insert share', insertError)
    return { error: 'Failed to create invitation. Please try again.' }
  }

  revalidatePath('/profile')
  return { success: `Invitation sent successfully to ${email}.` }
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

  if (!shareId) {
    throw new Error('Invalid invitation link.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    throw new Error('You must be signed in to accept an invitation.')
  }

  // 1. Fetch the share record
  const { data: share, error: shareError } = await supabase
    .from('baby_shares')
    .select('id, email, status, baby_id')
    .eq('id', shareId)
    .maybeSingle()

  if (shareError || !share) {
    throw new Error('Invitation not found or has been revoked.')
  }

  if (share.status === 'accepted') {
    throw new Error('This invitation has already been accepted.')
  }

  // 2. Ensure email matches
  if (share.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error(`This invitation was sent to ${share.email}, but you are signed in as ${user.email}.`)
  }

  // 3. Update the share record to accept
  const { error: updateError } = await supabase
    .from('baby_shares')
    .update({
      status: 'accepted',
      profile_id: user.id,
    })
    .eq('id', shareId)

  if (updateError) {
    console.error('[invite] failed to accept share', updateError)
    throw new Error('Failed to accept invitation. Please try again.')
  }

  // Set onboarding_completed to true on the guest's profile so they bypass onboarding redirect
  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  if (profileUpdateError) {
    console.error('[invite] failed to update profile onboarding status', profileUpdateError)
  }

  revalidatePath('/dashboard')
  revalidatePath('/profile')
  
  redirect('/dashboard')
}
