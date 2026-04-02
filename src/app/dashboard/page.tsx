import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logoutAction } from '@/app/auth-actions'
import { createClient } from '@/lib/supabase/server'
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
    .select('id, name')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: recentSleepLogs } = baby
    ? await supabase
        .from('sleep_logs')
        .select('id')
        .eq('baby_id', baby.id)
        .order('started_at', { ascending: false })
        .limit(7)
    : { data: [] }

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
              Your main shell is in place. Sleep logging is now live, and the next
              layer is turning this into a richer nightly summary.
            </p>
          </div>

          <form action={logoutAction}>
            <button className={styles.logoutButton} type="submit">
              Sign out
            </button>
          </form>
        </div>

        <div className={styles.grid}>
          <article className={styles.panel}>
            <h2>Current focus</h2>
            <p>
              {baby?.name
                ? `${baby.name}'s profile is set up and ready for real sleep data.`
                : 'Your profile is set up and ready for real sleep data.'}
            </p>
            <Link className={styles.inlineLink} href="/sleep">
              Open sleep logging
            </Link>
          </article>

          <article className={styles.panel}>
            <h2>Recent activity</h2>
            <p>
              {recentSleepLogs?.length
                ? `You have ${recentSleepLogs.length} logged sleep session${recentSleepLogs.length === 1 ? '' : 's'} so far.`
                : 'No sleep sessions logged yet. Your next useful step is to log your first sleep.'}
            </p>
            <Link className={styles.inlineLink} href="/sleep">
              Go to sleep page
            </Link>
          </article>
        </div>
      </section>
    </main>
  )
}
