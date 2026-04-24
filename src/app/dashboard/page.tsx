import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DailyPlanPanel } from '@/components/dashboard/DailyPlanPanel'
import { SleepScorePanel } from '@/components/dashboard/SleepScorePanel'
import { selectDailyPlanForDashboard } from '@/lib/daily-plan-derivation'
import { normalizeDailyPlanRow } from '@/lib/daily-plan'
import { getAgeInWeeks, getDateStringForTimezone } from '@/lib/date-utils'
import {
  normalizeDayStructure,
  normalizeNapPattern,
  normalizeSchedulePreference,
  normalizeSleepStyleLabel,
  parseNightFeeds,
} from '@/lib/onboarding-preferences'
import { ensureSleepPlanProfile } from '@/lib/sleep-plan-profile-init'
import {
  normalizeSleepPlanChangeEventRow,
  normalizeSleepPlanClockTime,
  type SleepPlanChangeEventRecord,
  type SleepPlanProfileRecord,
} from '@/lib/sleep-plan-profile'
import { createClient } from '@/lib/supabase/server'
import { sanitizeTimezone } from '@/lib/billing/usage'
import {
  calculateSleepScore,
  getSleepScoreLookbackStart,
  SLEEP_SCORE_FETCH_LIMIT,
} from '@/lib/scoring/sleep-score'
import styles from './page.module.css'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, onboarding_completed, timezone')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const timezone = sanitizeTimezone(profile.timezone)

  const { data: baby } = await supabase
    .from('babies')
    .select('id, name, date_of_birth')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: preferencesRow } = baby
    ? await supabase
        .from('onboarding_preferences')
        .select(
          'sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference'
        )
        .eq('baby_id', baby.id)
        .maybeSingle()
    : { data: null }

  let sleepPlanProfile: SleepPlanProfileRecord | null = null

  if (baby) {
    try {
      const ensureResult = await ensureSleepPlanProfile({
        supabase,
        source: 'system',
        id: baby.id,
        name: baby.name,
        dateOfBirth: baby.date_of_birth,
        sleepStyleLabel: normalizeSleepStyleLabel(preferencesRow?.sleep_style_label),
        typicalWakeTime: normalizeSleepPlanClockTime(preferencesRow?.typical_wake_time),
        dayStructure: normalizeDayStructure(preferencesRow?.day_structure),
        napPattern: normalizeNapPattern(preferencesRow?.nap_pattern),
        nightFeeds: parseNightFeeds(
          typeof preferencesRow?.night_feeds === 'boolean'
            ? preferencesRow.night_feeds
              ? 'yes'
              : 'no'
            : null
        ),
        schedulePreference: normalizeSchedulePreference(preferencesRow?.schedule_preference),
      })
      sleepPlanProfile = ensureResult.profile
    } catch (profileBootstrapError) {
      console.error('[dashboard] failed to bootstrap sleep plan profile', profileBootstrapError)
    }
  }

  const todayPlanDate = getDateStringForTimezone(timezone)

  const { data: dailyPlanRow, error: dailyPlanError } = baby
    ? await supabase
        .from('daily_plans')
        .select('id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at')
        .eq('baby_id', baby.id)
        .eq('plan_date', todayPlanDate)
        .maybeSingle()
    : { data: null, error: null }

  if (dailyPlanError) {
    console.error('[dashboard] failed to load daily plan', dailyPlanError)
  }

  const dailyPlan = normalizeDailyPlanRow(dailyPlanRow)
  const { data: changeEventRows } = baby
    ? await supabase
        .from('sleep_plan_change_events')
        .select(
          'id, baby_id, sleep_plan_profile_id, plan_date, change_scope, change_source, change_kind, evidence_confidence, summary, rationale, before_snapshot, after_snapshot, created_at'
        )
        .eq('baby_id', baby.id)
        .order('created_at', { ascending: false })
        .limit(12)
    : { data: [] }
  const normalizedChangeEvents = (changeEventRows ?? [])
    .map((row) => normalizeSleepPlanChangeEventRow(row))
    .filter((row): row is SleepPlanChangeEventRecord => row !== null)
  const latestDailyChangeEvent = normalizedChangeEvents.find(
    (event) => event.changeScope === 'daily' && event.planDate === todayPlanDate
  )
  const ageInWeeks = baby ? getAgeInWeeks(baby.date_of_birth, todayPlanDate) : null
  const selectedPlan = baby
    ? selectDailyPlanForDashboard({
        savedPlan: dailyPlan,
        profile: sleepPlanProfile,
        ageInWeeks,
        babyId: baby.id,
        babyName: baby.name,
        planDate: todayPlanDate,
      })
    : { source: 'none' as const, plan: null }
  const initialPlan =
    selectedPlan.plan &&
    selectedPlan.source === 'saved_daily_plan' &&
    latestDailyChangeEvent
      ? {
          ...selectedPlan.plan,
          updatedAt: latestDailyChangeEvent.createdAt,
          metadata: {
            origin: 'saved_daily_plan' as const,
            confidence: latestDailyChangeEvent.evidenceConfidence,
            reasonSummary: latestDailyChangeEvent.summary,
          },
        }
      : selectedPlan.plan
  const lookbackStart = getSleepScoreLookbackStart()

  const { data: activeLog } = baby
    ? await supabase
        .from('sleep_logs')
        .select('id, started_at, ended_at, is_night, tags')
        .eq('baby_id', baby.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const { data: recentSleepLogs } = baby
    ? await supabase
        .from('sleep_logs')
        .select('id, started_at, ended_at, is_night, tags')
        .eq('baby_id', baby.id)
        .gte('started_at', lookbackStart.toISOString())
        .order('started_at', { ascending: false })
        .limit(SLEEP_SCORE_FETCH_LIMIT)
    : { data: [] }

  const sleepScore = baby
    ? calculateSleepScore(baby.date_of_birth, [
        ...(recentSleepLogs ?? []).map((log) => ({
          startedAt: log.started_at,
          endedAt: log.ended_at,
          isNight: log.is_night,
          tags: log.tags ?? [],
        })),
        ...(activeLog
          ? [
              {
                startedAt: activeLog.started_at,
                endedAt: activeLog.ended_at,
                isNight: activeLog.is_night,
                tags: activeLog.tags ?? [],
              },
            ]
          : []),
      ])
    : null

  const firstName = profile.full_name?.trim().split(/\s+/)[0]
  const dashboardTitle = firstName ? `Hi, ${firstName}.` : 'Hi there.'

  return (
    <main className={styles.page}>
      <section className={`${styles.card} card`}>
        <div className={styles.header}>
          <div>
            <p className={`${styles.eyebrow} text-label`}>Dashboard</p>
            <h1 className={`${styles.title} text-display`}>{dashboardTitle}</h1>
            <div className={styles.actions}>
              <Link className={styles.quickLink} href="/sleep">
                Sleep
              </Link>
              <Link className={styles.quickLink} href="/chat">
                Chat
              </Link>
            </div>
          </div>
        </div>

        <SleepScorePanel
          sleepScore={sleepScore}
          hasActiveSleep={Boolean(activeLog)}
          styles={styles}
        />

        <DailyPlanPanel
          babyName={baby?.name ?? 'your baby'}
          initialPlan={initialPlan}
          sleepPlanProfile={sleepPlanProfile}
          todayPlanDate={todayPlanDate}
        />
      </section>
    </main>
  )
}
