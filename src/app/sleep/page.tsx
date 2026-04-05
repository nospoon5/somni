import { redirect } from 'next/navigation'
import { SleepTracker } from '@/components/sleep/SleepTracker'
import { createClient } from '@/lib/supabase/server'
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
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const { data: baby } = await supabase
    .from('babies')
    .select('id, name')
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

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <p className={`${styles.eyebrow} text-label`}>Sleep</p>
        <h1 className={`${styles.heading} text-display`}>Sleep logging for {baby.name}</h1>
        <p className={`${styles.body} text-body`}>
          Start a session when sleep begins, then end it when your baby wakes.
          Tags and notes stay optional so the core flow remains fast.
        </p>
      </section>

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