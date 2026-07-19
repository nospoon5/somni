'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createRequestLogger } from '@/lib/observability/logger'
import { redirect } from 'next/navigation'
import { sanitizeTimezone } from '@/lib/billing/usage'
import { getDateStringForTimezone, normalizeDailyPlanRow } from '@/lib/daily-plan'
import {
  normalizeDayStructure,
  normalizeNapPattern,
  normalizeSchedulePreference,
  normalizeSleepStyleLabel,
  parseNightFeeds,
} from '@/lib/onboarding-preferences'
import { evaluateSleepPlanAdaptation } from '@/lib/sleep-plan-log-adaptation'
import {
  ensureSleepPlanProfile,
} from '@/lib/sleep-plan-profile-init'
import {
  buildDailyPlanSnapshot,
  buildSleepPlanProfileSnapshot,
  normalizeSleepPlanClockTime,
  normalizeSleepPlanProfileRow,
} from '@/lib/sleep-plan-profile'
import {
  getSleepScoreLookbackStart,
  SLEEP_SCORE_FETCH_LIMIT,
} from '@/lib/scoring/sleep-score'
import {
  sendNotificationToUser,
  type NotificationSendOptions,
} from '@/lib/notifications/sender'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'
import { readActiveBabyId, resolveStrictActiveBaby } from '@/lib/babies/active-baby'

export type SleepActionState = {
  error?: string
  success?: string
}

const ONBOARDING_PREFERENCE_SELECT =
  'sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference'
const DAILY_PLAN_SELECT =
  'id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at'
const SLEEP_PLAN_PROFILE_SELECT =
  'id, baby_id, age_band, template_key, usual_wake_time, target_bedtime, target_nap_count, wake_window_profile, feed_anchor_profile, schedule_preference, day_structure, adaptation_confidence, learning_state, last_auto_adjusted_at, last_evidence_summary, created_at, updated_at'

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function isNightTime(date: Date) {
  const hour = date.getHours()
  return hour >= 19 || hour < 6
}

function toJson(value: unknown): Json {
  return value as Json
}

function getSleepNotificationBody(
  actorDisplayName: string,
  babyName: string,
  updateKind: SleepUpdateKind
) {
  const normalizedActorName = actorDisplayName.trim() || 'A caregiver'
  const actionText = updateKind === 'started' ? 'started' : 'completed'
  return `${normalizedActorName} ${actionText} ${babyName}'s sleep session.`
}

async function notifyOtherCaregiversOfSleepUpdate(
  context: CurrentSleepContext,
  updateKind: SleepUpdateKind,
  options: NotificationSendOptions = {}
) {
  const [{ data: babyOwner }, { data: acceptedShares, error: sharesError }] = await Promise.all([
    context.supabase.from('babies').select('profile_id').eq('id', context.babyId).maybeSingle(),
    context.supabase
      .from('baby_shares')
      .select('profile_id')
      .eq('baby_id', context.babyId)
      .eq('status', 'accepted'),
  ])

  if (sharesError) {
    throw sharesError
  }

  const recipientIds = new Set<string>()

  if (babyOwner?.profile_id && babyOwner.profile_id !== context.currentProfileId) {
    recipientIds.add(babyOwner.profile_id)
  }

  for (const share of acceptedShares ?? []) {
    if (share.profile_id && share.profile_id !== context.currentProfileId) {
      recipientIds.add(share.profile_id)
    }
  }

  if (recipientIds.size === 0) {
    return
  }

  const title = 'Sleep Session Update'
  const body = getSleepNotificationBody(
    context.currentUserDisplayName,
    context.babyName,
    updateKind
  )

  await Promise.allSettled(
    [...recipientIds].map((profileId) =>
      sendNotificationToUser(profileId, title, body, '/sleep', options)
    )
  )
}

type CurrentSleepContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  babyId: string
  babyName: string
  babyDateOfBirth: string
  currentProfileId: string
  currentUserDisplayName: string
  timezone: string
}

type SleepUpdateKind = 'started' | 'completed'

class ActiveBabyAccessError extends Error {}

function activeBabyAccessFailure(error: unknown): SleepActionState | null {
  return error instanceof ActiveBabyAccessError
    ? { error: 'You no longer have access to this baby.' }
    : null
}

async function getCurrentUserSleepContext(): Promise<CurrentSleepContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, timezone, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const preferredBabyId = await readActiveBabyId()
  const { data: babies } = await supabase
    .from('babies')
    .select('id, name, date_of_birth')
    .order('created_at', { ascending: true })
  const baby = resolveStrictActiveBaby(babies ?? [], preferredBabyId)

  if (!baby) {
    if (preferredBabyId) {
      throw new ActiveBabyAccessError('Selected baby is no longer accessible')
    }
    redirect('/onboarding')
  }

  return {
    supabase,
    babyId: baby.id,
    babyName: baby.name,
    babyDateOfBirth: baby.date_of_birth,
    currentProfileId: user.id,
    currentUserDisplayName: profile.full_name?.trim() || user.email?.trim() || 'A caregiver',
    timezone: sanitizeTimezone(profile.timezone),
  }
}

async function maybeApplyLogDrivenAdaptation(args: CurrentSleepContext & { now: Date }) {
  const { data: preferencesRow } = await args.supabase
    .from('onboarding_preferences')
    .select(ONBOARDING_PREFERENCE_SELECT)
    .eq('baby_id', args.babyId)
    .maybeSingle()

  const { profile: currentProfile } = await ensureSleepPlanProfile({
    supabase: args.supabase,
    source: 'system',
    id: args.babyId,
    name: args.babyName,
    dateOfBirth: args.babyDateOfBirth,
    sleepStyleLabel: normalizeSleepStyleLabel(preferencesRow?.sleep_style_label),
    typicalWakeTime: normalizeSleepPlanClockTime(preferencesRow?.typical_wake_time),
    dayStructure: normalizeDayStructure(preferencesRow?.day_structure),
    napPattern: normalizeNapPattern(preferencesRow?.nap_pattern),
    nightFeeds: parseNightFeeds(preferencesRow?.night_feeds),
    schedulePreference: normalizeSchedulePreference(preferencesRow?.schedule_preference),
  })

  if (!currentProfile) {
    throw new Error('Sleep plan profile could not be loaded')
  }

  const planDate = getDateStringForTimezone(args.timezone, args.now)
  const { data: currentDailyPlanRow } = await args.supabase
    .from('daily_plans')
    .select(DAILY_PLAN_SELECT)
    .eq('baby_id', args.babyId)
    .eq('plan_date', planDate)
    .maybeSingle()

  const currentDailyPlan = normalizeDailyPlanRow(currentDailyPlanRow)
  const { data: recentLogs } = await args.supabase
    .from('sleep_logs')
    .select('started_at, ended_at, is_night, tags, notes')
    .eq('baby_id', args.babyId)
    .gte('started_at', getSleepScoreLookbackStart(args.now).toISOString())
    .order('started_at', { ascending: false })
    .limit(SLEEP_SCORE_FETCH_LIMIT)

  const evaluation = evaluateSleepPlanAdaptation({
    profile: currentProfile,
    currentPlan: currentDailyPlan,
    dateOfBirth: args.babyDateOfBirth,
    timezone: args.timezone,
    logs:
      recentLogs?.map((log) => ({
        startedAt: log.started_at,
        endedAt: log.ended_at,
        isNight: log.is_night,
        tags: log.tags ?? [],
        notes: log.notes,
      })) ?? [],
    now: args.now,
  })

  if (evaluation.decision === 'apply_baseline_shift' && evaluation.nextProfile) {
    const { data: savedProfileRow, error: saveProfileError } = await args.supabase
      .from('sleep_plan_profiles')
      .update({
        usual_wake_time: evaluation.nextProfile.usualWakeTime,
        target_bedtime: evaluation.nextProfile.targetBedtime,
        target_nap_count: evaluation.nextProfile.targetNapCount,
        wake_window_profile: evaluation.nextProfile.wakeWindowProfile,
        feed_anchor_profile: evaluation.nextProfile.feedAnchorProfile,
        schedule_preference: evaluation.nextProfile.schedulePreference,
        day_structure: evaluation.nextProfile.dayStructure,
        adaptation_confidence: evaluation.nextProfile.adaptationConfidence,
        learning_state: evaluation.nextProfile.learningState,
        last_auto_adjusted_at: evaluation.nextProfile.lastAutoAdjustedAt ?? undefined,
        last_evidence_summary: evaluation.summary,
        updated_at: evaluation.nextProfile.updatedAt ?? undefined,
      })
      .eq('id', currentProfile!.id)
      .eq('baby_id', args.babyId)
      .select(SLEEP_PLAN_PROFILE_SELECT)
      .single()

    if (saveProfileError) {
      throw saveProfileError
    }

    const savedProfile = normalizeSleepPlanProfileRow(savedProfileRow)
    if (!savedProfile) {
      throw new Error('Sleep plan profile save returned an empty payload')
    }

    const { error: eventError } = await args.supabase.from('sleep_plan_change_events').insert({
      baby_id: args.babyId,
      sleep_plan_profile_id: savedProfile.id,
      change_scope: 'profile',
      change_source: 'logs',
      change_kind: 'baseline_shift',
      evidence_confidence: evaluation.evidenceConfidence,
      summary: evaluation.summary,
      rationale: evaluation.rationale,
      before_snapshot: buildSleepPlanProfileSnapshot(currentProfile),
      after_snapshot: buildSleepPlanProfileSnapshot(savedProfile),
    })

    if (eventError) {
      throw eventError
    }

    revalidatePath('/dashboard')
    return {
      successMessage:
        'Sleep session saved. Somni updated the learned baseline from repeated logged patterns.',
    }
  }

  if (evaluation.decision === 'apply_daily_rescue' && evaluation.nextPlan) {
    const pendingPlan = (evaluation as { pendingPlan?: unknown }).pendingPlan
    const { data: savedPlanRow, error: savePlanError } = await args.supabase
      .from('daily_plans')
      .upsert(
        {
          baby_id: args.babyId,
          plan_date: evaluation.nextPlan.planDate,
          sleep_targets: toJson(evaluation.nextPlan.sleepTargets),
          feed_targets: toJson(evaluation.nextPlan.feedTargets),
          pending_rescue_targets: pendingPlan == null ? undefined : toJson(pendingPlan),
          rescue_dismissed: false,
        },
        {
          onConflict: 'baby_id,plan_date',
        }
      )
      .select(DAILY_PLAN_SELECT)
      .single()

    if (savePlanError) {
      throw savePlanError
    }

    const savedPlan = normalizeDailyPlanRow(savedPlanRow)
    if (!savedPlan) {
      throw new Error('Daily plan save returned an empty payload')
    }

    const { error: eventError } = await args.supabase.from('sleep_plan_change_events').insert({
      baby_id: args.babyId,
      sleep_plan_profile_id: currentProfile!.id,
      plan_date: evaluation.nextPlan.planDate,
      change_scope: 'daily',
      change_source: 'logs',
      change_kind: 'daily_rescue',
      evidence_confidence: evaluation.evidenceConfidence,
      summary: evaluation.summary,
      rationale: evaluation.rationale,
      before_snapshot: buildDailyPlanSnapshot(evaluation.basePlan) ?? {},
      after_snapshot: buildDailyPlanSnapshot(savedPlan) ?? {},
    })

    if (eventError) {
      throw eventError
    }

    revalidatePath('/dashboard')
    revalidatePath('/sleep')
    return {
      successMessage: "Sleep session saved. Somni calculated a daily rescue schedule. Check your dashboard to apply the shifts.",
    }
  }

  return null
}

export async function acceptDailyRescueAction(
  babyId: string,
  planDate: string
): Promise<SleepActionState> {
  const actionLogger = createRequestLogger({ action: 'acceptDailyRescueAction' })
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // 1. Fetch current daily plan to get pending_rescue_targets
  const { data: planRow, error: fetchError } = await supabase
    .from('daily_plans')
    .select('id, pending_rescue_targets')
    .eq('baby_id', babyId)
    .eq('plan_date', planDate)
    .maybeSingle()

  if (fetchError) {
    return { error: fetchError.message }
  }

  if (!planRow || !planRow.pending_rescue_targets) {
    return { error: 'No pending rescue schedule found for today.' }
  }

  const pending = planRow.pending_rescue_targets as { sleepTargets?: unknown[]; feedTargets?: unknown[]; rationale?: string }

  // 2. Update the daily plan: copy sleepTargets and feedTargets, clear pending_rescue_targets
  const { data: updateData, error: updateError } = await supabase
    .from('daily_plans')
    .update({
      sleep_targets: toJson(pending.sleepTargets),
      feed_targets: toJson(pending.feedTargets),
      pending_rescue_targets: null,
      rescue_dismissed: false,
    })
    .eq('id', planRow.id)
    .not('pending_rescue_targets', 'is', null)
    .select('id')

  if (updateError || !updateData || updateData.length === 0) {
    return { error: 'Failed to accept schedule. It may have already been accepted or dismissed.' }
  }

  // Write a change event for auditing
  try {
    await supabase.from('sleep_plan_change_events').insert({
      baby_id: babyId,
      plan_date: planDate,
      change_scope: 'daily',
      change_source: 'user',
      change_kind: 'apply_rescue',
      evidence_confidence: 'high',
      summary: 'Daily rescue schedule applied by caregiver.',
      rationale: pending.rationale || 'Caregiver accepted the calculated intra-day schedule shifts.',
      before_snapshot: {},
      after_snapshot: toJson({
        sleep_targets: pending.sleepTargets,
        feed_targets: pending.feedTargets,
      }),
    })
  } catch (err) {
    actionLogger.error('Failed to log change event for rescue acceptance:', {}, err instanceof Error ? err : new Error(String(err)))
  }

  revalidatePath('/dashboard')
  revalidatePath('/sleep')
  return { success: 'Schedule updated successfully.' }
}

export async function dismissDailyRescueAction(
  babyId: string,
  planDate: string
): Promise<SleepActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error: updateError } = await supabase
    .from('daily_plans')
    .update({
      rescue_dismissed: true,
    })
    .eq('baby_id', babyId)
    .eq('plan_date', planDate)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/sleep')
  return { success: 'Rescue schedule suggestion dismissed.' }
}

export async function startSleepAction(): Promise<SleepActionState> {
  const reqLogger = createRequestLogger({ action: 'startSleepAction' })
  let context: CurrentSleepContext
  try {
    context = await getCurrentUserSleepContext()
  } catch (error) {
    const accessFailure = activeBabyAccessFailure(error)
    if (accessFailure) return accessFailure
    throw error
  }
  const { supabase, babyId } = context

  const { data: activeLog } = await supabase
    .from('sleep_logs')
    .select('id')
    .eq('baby_id', babyId)
    .is('ended_at', null)
    .maybeSingle()

  if (activeLog) {
    return { error: 'A sleep session is already running.' }
  }

  const now = new Date()

  const { error } = await reqLogger.timeStage('sleep_writes', async () => await supabase.from('sleep_logs').insert({
    baby_id: babyId,
    started_at: now.toISOString(),
    is_night: isNightTime(now),
    tags: [],
    logged_by: context.currentProfileId,
  }))

  if (error) {
    return { error: error.message ?? 'We could not start sleep logging.' }
  }

  try {
    await reqLogger.timeStage('notification_feed_persistence', () =>
      notifyOtherCaregiversOfSleepUpdate(context, 'started', { includePush: false })
    )
  } catch (notificationError) {
    reqLogger.error('[sleep] failed to persist caregiver feed for a started sleep session', {}, notificationError instanceof Error ? notificationError : new Error(String(notificationError)))
  }

  after(async () => {
    try {
      await reqLogger.timeStage('notification_push_delivery', () =>
        notifyOtherCaregiversOfSleepUpdate(context, 'started', { includeFeed: false })
      )
    } catch (notificationError) {
      reqLogger.error(
        '[sleep] failed to deliver caregiver push for a started sleep session',
        {},
        notificationError instanceof Error
          ? notificationError
          : new Error(String(notificationError))
      )
    }
  })

  return { success: 'Sleep tracking has started.' }
}

export async function endSleepAction(
  _previousState: SleepActionState,
  formData: FormData
): Promise<SleepActionState> {
  const reqLogger = createRequestLogger({ action: 'endSleepAction' })
  let context: CurrentSleepContext
  try {
    context = await getCurrentUserSleepContext()
  } catch (error) {
    const accessFailure = activeBabyAccessFailure(error)
    if (accessFailure) return accessFailure
    throw error
  }
  const { supabase, babyId } = context
  const activeLogId = getString(formData, 'activeLogId')
  const notes = getString(formData, 'notes')
  const tags = formData
    .getAll('tags')
    .filter((value): value is string => typeof value === 'string')

  if (!activeLogId) {
    return { error: 'We could not find the active sleep session.' }
  }

  const now = new Date()

  const { data, error } = await reqLogger.timeStage('sleep_writes', async () => await supabase
    .from('sleep_logs')
    .update({
      ended_at: now.toISOString(),
      notes: notes || undefined,
      tags,
    })
    .eq('id', activeLogId)
    .eq('baby_id', babyId)
    .is('ended_at', null)
    .select('id')
  )

  if (error) {
    return { error: error.message ?? 'We could not end this sleep session.' }
  }

  // If the log was already ended (0 rows returned), skip adaptation and notifications.
  if (!data || data.length === 0) {
    return { success: 'This sleep session was already completed.' }
  }

  try {
    await reqLogger.timeStage('notification_feed_persistence', () =>
      notifyOtherCaregiversOfSleepUpdate(context, 'completed', { includePush: false })
    )
  } catch (notificationError) {
    reqLogger.error(
      '[sleep] failed to persist caregiver feed for a completed sleep session',
      {},
      notificationError instanceof Error ? notificationError : new Error(String(notificationError))
    )
  }

  after(async () => {
    try {
      await reqLogger.timeStage('notification_push_delivery', () =>
        notifyOtherCaregiversOfSleepUpdate(context, 'completed', { includeFeed: false })
      )
    } catch (notificationError) {
      reqLogger.error(
        '[sleep] failed to deliver caregiver push for a completed sleep session',
        {},
        notificationError instanceof Error
          ? notificationError
          : new Error(String(notificationError))
      )
    }
  })

  try {
    const adaptationResult = await reqLogger.timeStage('log_driven_adaptation', () => maybeApplyLogDrivenAdaptation({
      ...context,
      now,
    }))

    if (adaptationResult?.successMessage) {
      return { success: adaptationResult.successMessage }
    }
  } catch (adaptationError) {
    reqLogger.error('[sleep] failed to apply log-driven adaptation', {}, adaptationError instanceof Error ? adaptationError : new Error(String(adaptationError)))
  }

  return { success: 'Sleep session saved.' }
}

export async function updateSleepLogAction(
  logId: string,
  startedAt: string,
  endedAt: string | null,
  tags: string[],
  notes: string | null
): Promise<SleepActionState> {
  const reqLogger = createRequestLogger({ action: 'updateSleepLogAction' })
  let context: CurrentSleepContext
  try {
    context = await getCurrentUserSleepContext()
  } catch (error) {
    const accessFailure = activeBabyAccessFailure(error)
    if (accessFailure) return accessFailure
    throw error
  }
  const { supabase, babyId } = context

  if (!logId) {
    return { error: 'Invalid log selection.' }
  }

  const start = new Date(startedAt)
  const end = endedAt ? new Date(endedAt) : null

  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
    return { error: 'Please enter valid timestamps.' }
  }

  if (end && start.getTime() >= end.getTime()) {
    return { error: 'Start time must be before end time.' }
  }

  // Prevent editing logs from more than 48 hours ago to protect baseline integrity.
  const limitTime = Date.now() - 48 * 60 * 60 * 1000
  if (start.getTime() < limitTime) {
    return { error: 'For baseline integrity, logs older than 48 hours cannot be modified.' }
  }

  const { error } = await supabase
    .from('sleep_logs')
    .update({
      started_at: startedAt,
      ended_at: endedAt || undefined,
      tags,
      notes: notes || undefined,
    })
    .eq('id', logId)
    .eq('baby_id', babyId)

  if (error) {
    reqLogger.error('[sleep] failed to update sleep log', { logId }, error)
    return { error: error.message || 'Could not update sleep log.' }
  }

  // Trigger adaptation check when log is updated.
  try {
    const adaptationResult = await maybeApplyLogDrivenAdaptation({
      ...context,
      now: new Date(),
    })
    if (adaptationResult?.successMessage) {
      return { success: `Log updated. ${adaptationResult.successMessage}` }
    }
  } catch (adaptationError) {
    reqLogger.error('[sleep] failed to apply log-driven adaptation after update', {}, adaptationError instanceof Error ? adaptationError : new Error(String(adaptationError)))
  }

  revalidatePath('/sleep')
  revalidatePath('/dashboard')
  return { success: 'Sleep log updated successfully.' }
}
