import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SleepTracker } from '@/components/sleep/SleepTracker'
import { DaySleepProgress } from '@/components/sleep/DaySleepProgress'
import { createClient } from '@/lib/supabase/server'
import { getAgeBand, getTargetsForAgeBand } from '@/lib/scoring/sleep-score'
import { getTimeZoneParts, zonedTimeToUtc } from '@/lib/billing/usage'
import styles from './page.module.css'

export default async function SleepPage() {
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

  const { data: activeLog } = await supabase
    .from('sleep_logs')
    .select('id, started_at')
    .eq('baby_id', baby.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: recentLogs } = await supabase
    .from('sleep_logs')
    .select('id, started_at, ended_at, is_night, tags, notes')
    .eq('baby_id', baby.id)
    .order('started_at', { ascending: false })
    .limit(8)

  const ageBand = getAgeBand(baby.date_of_birth)
  const sleepTargets = getTargetsForAgeBand(ageBand)
  const targetDayMinutes = sleepTargets.dayHoursPerDay * 60

  const timezone = profile.timezone || 'Australia/Sydney'
  const todayParts = getTimeZoneParts(timezone, new Date())
  const startOfDayUtc = zonedTimeToUtc({
    year: todayParts.year,
    month: todayParts.month,
    day: todayParts.day,
    hour: 0,
    minute: 0,
    second: 0,
    timezone,
  }).toISOString()
  const endOfDayUtc = zonedTimeToUtc({
    year: todayParts.year,
    month: todayParts.month,
    day: todayParts.day,
    hour: 23,
    minute: 59,
    second: 59,
    timezone,
  }).toISOString()

  const { data: todayDayLogs } = await supabase
    .from('sleep_logs')
    .select('started_at, ended_at')
    .eq('baby_id', baby.id)
    .eq('is_night', false)
    .gte('started_at', startOfDayUtc)
    .lte('started_at', endOfDayUtc)

  let loggedMinutes = 0
  let activeNapStart: string | null = null

  if (todayDayLogs) {
    for (const log of todayDayLogs) {
      if (log.ended_at) {
        const start = new Date(log.started_at).getTime()
        const end = new Date(log.ended_at).getTime()
        loggedMinutes += Math.max(0, Math.floor((end - start) / 60000))
      } else {
        // We have an active day nap today.
        activeNapStart = log.started_at
      }
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <p className={`${styles.eyebrow} text-label`}>Sleep</p>
        <h1 className={`${styles.heading} text-display`}>Sleep logging for {baby.name}</h1>
        <p className={`${styles.body} text-body`}>
          Start a session when sleep begins, then end it when your baby wakes.
          Tags and notes stay optional so the core flow remains fast.
        </p>
        <Link
          href="/dashboard"
          className="text-body"
          style={{ display: 'inline-block', marginBottom: '1rem', color: 'var(--color-text-muted)' }}
        >
          &larr; Back to Dashboard
        </Link>
      </section>

      <DaySleepProgress
        targetMinutes={targetDayMinutes}
        loggedMinutes={loggedMinutes}
        activeNapStart={activeNapStart}
      />

      <SleepTracker
        activeLog={
          activeLog
            ? {
                id: activeLog.id,
                startedAt: activeLog.started_at,
              }
            : null
        }
        recentLogs={
          recentLogs?.map((log) => ({
            id: log.id,
            startedAt: log.started_at,
            endedAt: log.ended_at,
            isNight: log.is_night,
            tags: log.tags ?? [],
            notes: log.notes,
          })) ?? []
        }
      />
    </main>
  )
}