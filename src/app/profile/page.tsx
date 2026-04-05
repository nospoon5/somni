import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logoutAction } from '@/app/auth-actions'
import { createClient } from '@/lib/supabase/server'
import { ensureSubscriptionRecord, hasPremiumAccess } from '@/lib/billing/subscriptions'
import styles from './page.module.css'

export default async function ProfilePage() {
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

  const subscription = await ensureSubscriptionRecord({
    profileId: user.id,
    email: user.email ?? null,
  })

  const premium = hasPremiumAccess(subscription)

  return (
    <main className={styles.page}>
      <section className={`${styles.card} card`}>
        <p className={`${styles.eyebrow} text-label`}>Profile</p>
        <h1 className={`${styles.heading} text-display`}>Account details</h1>

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Identity</h2>
          <p className="text-body">
            <strong>Name:</strong> {profile.full_name || 'Not set'}
          </p>
          <p className="text-body">
            <strong>Email:</strong> {user.email || 'Not available'}
          </p>
        </article>

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Plan</h2>
          <div className={styles.badgeRow}>
            <span className={premium ? styles.premiumBadge : styles.freeBadge}>
              {premium ? 'Premium' : 'Free'}
            </span>
            <span className="text-body">Status: {subscription.status}</span>
          </div>
          <p className="text-body">
            Manage your subscription and payment settings in billing.
          </p>
          <div className={styles.actions}>
            <Link className="btn-primary" href="/billing">
              Open billing
            </Link>
            <Link className="btn-secondary" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </article>

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Session</h2>
          <form action={logoutAction}>
            <button className="btn-secondary" type="submit">
              Sign out
            </button>
          </form>
        </article>
      </section>
    </main>
  )
}
