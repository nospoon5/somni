import { SupabaseClient } from '@supabase/supabase-js'
import { getDateStringForTimezone, normalizeDailyPlanRow } from '@/lib/daily-plan'
import { getSleepScoreLookbackStart, SLEEP_SCORE_FETCH_LIMIT } from '@/lib/scoring/sleep-score'
import { ensureSubscriptionRecord } from '@/lib/billing/subscriptions'

export async function loadChatContext(args: {
  supabase: SupabaseClient
  userId: string
  profileEmail: string | null
  babyId: string
  conversationId: string
  timezone: string
}) {
  const localToday = getDateStringForTimezone(args.timezone)

  const [
    subscription,
    preferencesResult,
    currentDailyPlanResult,
    recentSleepLogsResult,
    recentMessagesResult,
  ] = await Promise.all([
    ensureSubscriptionRecord({
      profileId: args.userId,
      email: args.profileEmail,
    }),
    args.supabase
      .from('onboarding_preferences')
      .select(
        'sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference'
      )
      .eq('baby_id', args.babyId)
      .maybeSingle(),
    args.supabase
      .from('daily_plans')
      .select(
        'id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at, pending_rescue_targets, rescue_dismissed'
      )
      .eq('baby_id', args.babyId)
      .eq('plan_date', localToday)
      .maybeSingle(),
    args.supabase
      .from('sleep_logs')
      .select('started_at, ended_at, is_night, tags')
      .eq('baby_id', args.babyId)
      .gte('started_at', getSleepScoreLookbackStart().toISOString())
      .order('started_at', { ascending: false })
      .limit(SLEEP_SCORE_FETCH_LIMIT),
    args.supabase
      .from('messages')
      .select('role, content')
      .eq('profile_id', args.userId)
      .eq('baby_id', args.babyId)
      .eq('conversation_id', args.conversationId)
      .order('created_at', { ascending: true })
      .limit(8),
  ])

  return {
    subscription,
    preferences: preferencesResult.data ?? null,
    currentDailyPlan: normalizeDailyPlanRow(currentDailyPlanResult.data),
    recentSleepLogs: recentSleepLogsResult.data ?? [],
    recentMessages: recentMessagesResult.data ?? [],
    localToday,
  }
}
