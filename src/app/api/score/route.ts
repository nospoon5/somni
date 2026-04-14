import { createClient } from '@/lib/supabase/server'
import {
  calculateSleepScore,
  getSleepScoreLookbackStart,
  SLEEP_SCORE_FETCH_LIMIT,
} from '@/lib/scoring/sleep-score'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    return Response.json({ error: 'Onboarding incomplete' }, { status: 409 })
  }

  const { data: baby } = await supabase
    .from('babies')
    .select('id, date_of_birth')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!baby) {
    return Response.json({ error: 'Baby profile missing' }, { status: 404 })
  }

  const lookbackStart = getSleepScoreLookbackStart()

  const { data: activeLog } = await supabase
    .from('sleep_logs')
    .select('id, started_at, ended_at, is_night, tags')
    .eq('baby_id', baby.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: recentLogs } = await supabase
    .from('sleep_logs')
    .select('id, started_at, ended_at, is_night, tags')
    .eq('baby_id', baby.id)
    .gte('started_at', lookbackStart.toISOString())
    .order('started_at', { ascending: false })
    .limit(SLEEP_SCORE_FETCH_LIMIT)

  const logs = [
    ...(recentLogs ?? []).map((log) => ({
      startedAt: log.started_at,
      endedAt: log.ended_at,
      isNight: log.is_night,
      tags: log.tags ?? [],
    })),
  ]

  if (activeLog && !logs.some((log) => log.startedAt === activeLog.started_at)) {
    logs.unshift({
      startedAt: activeLog.started_at,
      endedAt: activeLog.ended_at,
      isNight: activeLog.is_night,
      tags: activeLog.tags ?? [],
    })
  }

  const summary = calculateSleepScore(baby.date_of_birth, logs)

  return Response.json({ summary })
}
