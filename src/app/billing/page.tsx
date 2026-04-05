import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ensureSubscriptionRecord, hasPremiumAccess } from '@/lib/billing/subscriptions'
import { BillingActions } from '@/components/billing/BillingActions'
import styles from './page.module.css'

export default async function BillingPage() {
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

  const subscription = await ensureSubscriptionRecord({
    profileId: user.id,
    email: user.email ?? null,
  })

  const billingEnabled = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_ANNUAL
  )

  const premium = hasPremiumAccess(subscription)

  return (
    <main className={styles.page}>
      <section className={`${styles.card} card`}>
        <p className={`${styles.eyebrow} text-label`}>Billing</p>
        <h1 className={`${styles.heading} text-display`}>Plan and subscription</h1>

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Current plan</h2>
          <div className={styles.badgeRow}>
            <span className={premium ? styles.premiumBadge : styles.freeBadge}>
              {premium ? 'Premium' : 'Free'}
            </span>
            <span className="text-body">{subscription.plan}</span>
            <span className="text-body">Status: {subscription.status}</span>
          </div>
          <p className="text-body">
            {premium
              ? 'Premium removes the free daily chat cap and keeps billing management in Stripe.'
              : 'Free plan includes daily chat limits. Upgrade anytime for uncapped coaching chat.'}
          </p>
          <BillingActions billingEnabled={billingEnabled} hasPremiumAccess={premium} />
        </article>

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Need help?</h2>
          <p className="text-body">
            If billing does not look right, send a support request and include what plan you expected.
          </p>
          <div className={styles.actions}>
            <Link className="btn-secondary" href="/support">
              Contact support
            </Link>
            <Link className="btn-secondary" href="/profile">
              Back to profile
            </Link>
          </div>
        </article>
      </section>
    </main>
  )
}
