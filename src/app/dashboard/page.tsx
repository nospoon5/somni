import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logoutAction } from '@/app/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { calculateSleepScore } from '@/lib/scoring/sleep-score'
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
    .select('full_name, onboarding_completed')
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
        .order('started_at', { ascending: false })
        .limit(7)
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

  const hasAnySleepData = Boolean((recentSleepLogs?.length ?? 0) > 0 || activeLog)

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Dashboard</p>
            <h1 className={styles.title}>
              {profile.full_name ? `Welcome, ${profile.full_name}.` : 'Welcome to Somni.'}
            </h1>
            <p className={styles.subtitle}>
              A calm snapshot of the last week, plus the fastest next steps for tonight.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/sleep">
                Log sleep
              </Link>
              <Link className={styles.secondaryAction} href="/chat">
                Ask Somni
              </Link>
            </div>
          </div>

          <form action={logoutAction}>
            <button className={styles.logoutButton} type="submit">
              Sign out
            </button>
          </form>
        </div>

        <div className={styles.scorePanel}>
          <div className={styles.scoreHeader}>
            <div>
              <p className={styles.scoreKicker}>Sleep score</p>
              <h2 className={styles.scoreTitle}>
                {sleepScore?.hasData
                  ? `${sleepScore.totalScore}/100`
                  : activeLog
                    ? 'Sleep in progress'
                    : 'Ready when you are'}
              </h2>
            </div>
            <span className={styles.scoreBadge}>
              {sleepScore?.statusLabel ?? 'No sleep data yet'}
            </span>
          </div>

          {sleepScore?.hasData ? (
            <>
              <p className={styles.scoreBody}>
                Strongest area: <strong>{sleepScore.strongestArea}</strong>
                {' | '}
                Biggest challenge: <strong>{sleepScore.biggestChallenge}</strong>
              </p>
              <p className={styles.scoreFocus}>{sleepScore.tonightFocus}</p>

              <div className={styles.metricGrid}>
                <article className={styles.metricCard}>
                  <span>Night sleep</span>
                  <strong>{sleepScore.breakdown.nightSleep}/100</strong>
                </article>
                <article className={styles.metricCard}>
                  <span>Day sleep</span>
                  <strong>{sleepScore.breakdown.daySleep}/100</strong>
                </article>
                <article className={styles.metricCard}>
                  <span>Total sleep</span>
                  <strong>{sleepScore.breakdown.totalSleep}/100</strong>
                </article>
                <article className={styles.metricCard}>
                  <span>Settling</span>
                  <strong>{sleepScore.breakdown.settling}/100</strong>
                </article>
              </div>

              <p className={styles.scoreMeta}>
                Age band: {sleepScore.ageBand} | Observed {sleepScore.observedSleepHours}h
                over the last 7 days | Target {sleepScore.targetSleepHours}h/day
              </p>
            </>
          ) : (
            <>
              <p className={styles.scoreBody}>
                {activeLog
                  ? 'When you end the current sleep session, Somni will start building a simple, explainable score from your history.'
                  : 'Log your first sleep and Somni will turn that history into a simple, explainable score.'}
              </p>

              <div className={styles.emptySteps} aria-label="Getting started steps">
                <div className={styles.step}>
                  <span className={styles.stepNumber}>1</span>
                  <div className={styles.stepBody}>
                    <strong>Log the next sleep</strong>
                    <span>
                      Tap <em>Log sleep</em>, then press Start when sleep begins and End when your baby wakes.
                    </span>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNumber}>2</span>
                  <div className={styles.stepBody}>
                    <strong>Add optional tags</strong>
                    <span>
                      If it helps later, add a quick tag like <em>feed</em> or <em>resettle</em>. Skip it if you’re tired.
                    </span>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNumber}>3</span>
                  <div className={styles.stepBody}>
                    <strong>Ask Somni one focused question</strong>
                    <span>
                      Best format: baby age + what happened + what you’ve tried + what you want to change.
                    </span>
                  </div>
                </div>
              </div>

              <p className={styles.emptyTip}>
                Tip: close enough is good enough. Consistency matters more than perfect timestamps.
              </p>
            </>
          )}
        </div>

        <div className={styles.grid}>
          <article className={styles.panel}>
            <h2>Current focus</h2>
            <p>
              {baby?.name
                ? `${baby.name}'s profile is set up and ready for real sleep data.`
                : 'Your profile is set up and ready for real sleep data.'}
            </p>
            <p className={styles.linkGroup}>
              <Link className={styles.inlineLink} href="/sleep">
                Open sleep logging
              </Link>
              {' | '}
              <Link className={styles.inlineLink} href="/chat">
                Open coaching chat
              </Link>
            </p>
          </article>

          <article className={styles.panel}>
            <h2>Recent activity</h2>
            <p>
              {activeLog
                ? 'A sleep session is currently in progress.'
                : hasAnySleepData
                  ? `You have ${recentSleepLogs?.length ?? 0} logged sleep session${(recentSleepLogs?.length ?? 0) === 1 ? '' : 's'} so far.`
                  : 'No sleep sessions logged yet. Log your first sleep and Somni will start spotting patterns.'}
            </p>
            <Link className={styles.inlineLink} href="/sleep">
              {hasAnySleepData ? 'View sleep history' : 'Log your first sleep'}
            </Link>
          </article>
        </div>
      </section>
    </main>
  )
}
