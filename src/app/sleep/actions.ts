'use server'

import { revalidatePath } from 'next/cache'
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
import { createClient } from '@/lib/supabase/server'

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

type CurrentSleepContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  babyId: string
  babyName: string
  babyDateOfBirth: string
  timezone: string
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
    .select('onboarding_completed, timezone')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const { data: baby } = await supabase
    .from('babies')
    .select('id, name, date_of_birth')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!baby) {
    redirect('/onboarding')
  }

  return {
    supabase,
    babyId: baby.id,
    babyName: baby.name,
    babyDateOfBirth: baby.date_of_birth,
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
        last_auto_adjusted_at: evaluation.nextProfile.lastAutoAdjustedAt,
        last_evidence_summary: evaluation.summary,
        updated_at: evaluation.nextProfile.updatedAt,
      })
      .eq('id', currentProfile.id)
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
    const { data: savedPlanRow, error: savePlanError } = await args.supabase
      .from('daily_plans')
      .upsert(
        {
          baby_id: args.babyId,
          plan_date: evaluation.nextPlan.planDate,
          sleep_targets: evaluation.nextPlan.sleepTargets,
          feed_targets: evaluation.nextPlan.feedTargets,
          notes: evaluation.nextPlan.notes,
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
      sleep_plan_profile_id: currentProfile.id,
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
    return {
      successMessage: "Sleep session saved. Somni adjusted today's plan after today's short naps.",
    }
  }

  return null
}

export async function startSleepAction(): Promise<SleepActionState> {
  const { supabase, babyId } = await getCurrentUserSleepContext()

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

  const { error } = await supabase.from('sleep_logs').insert({
    baby_id: babyId,
    started_at: now.toISOString(),
    is_night: isNightTime(now),
  })

  if (error) {
    return { error: error.message ?? 'We could not start sleep logging.' }
  }

  return { success: 'Sleep tracking has started.' }
}

export async function endSleepAction(
  _previousState: SleepActionState,
  formData: FormData
): Promise<SleepActionState> {
  const context = await getCurrentUserSleepContext()
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

  const { error } = await supabase
    .from('sleep_logs')
    .update({
      ended_at: now.toISOString(),
      notes: notes || null,
      tags,
    })
    .eq('id', activeLogId)
    .eq('baby_id', babyId)
    .is('ended_at', null)

  if (error) {
    return { error: error.message ?? 'We could not end this sleep session.' }
  }

  try {
    const adaptationResult = await maybeApplyLogDrivenAdaptation({
      ...context,
      now,
    })

    if (adaptationResult?.successMessage) {
      return { success: adaptationResult.successMessage }
    }
  } catch (adaptationError) {
    console.error('[sleep] failed to apply log-driven adaptation', adaptationError)
  }

  return { success: 'Sleep session saved.' }
}
