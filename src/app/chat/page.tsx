import { redirect } from 'next/navigation'
import { ChatCoach } from '@/components/chat/ChatCoach'
import { createClient } from '@/lib/supabase/server'
import {
  ensureSubscriptionRecord,
  hasPremiumAccess,
  type SubscriptionRecord,
} from '@/lib/billing/subscriptions'
import styles from './page.module.css'

export default async function ChatPage() {
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
    .select('name')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!baby) {
    redirect('/onboarding')
  }

  const billingEnabled = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_ANNUAL
  )
  const forceBillingFailure = process.env.SOMNI_FORCE_BILLING_FAILURE === '1'

  let billingDegradedReason: string | null = null
  let isReadOnly = false
  let subscription: SubscriptionRecord = {
    profile_id: user.id,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    plan: 'free',
    status: 'inactive',
    current_period_end: null,
    is_trial: false,
  }

  if (!billingEnabled) {
    billingDegradedReason =
      'Billing is not configured in this environment. Chat remains available, but upgrade and manage-billing actions are disabled.'
  } else {
    try {
      if (forceBillingFailure) {
        throw new Error('Simulated billing failure via SOMNI_FORCE_BILLING_FAILURE=1')
      }

      subscription = await ensureSubscriptionRecord({
        profileId: user.id,
        email: user.email ?? null,
      })
    } catch (billingError) {
      isReadOnly = true
      billingDegradedReason =
        'Billing is temporarily unavailable. Chat is in read-only safety mode while we reconnect billing.'
      console.error('Billing bootstrap failed for /chat. Falling back to read-only mode.', billingError)
    }
  }

  return (
    <main className={styles.page}>
      <ChatCoach
        babyName={baby.name}
        pageEyebrow="Chat"
        pageTitle={`Sleep coaching for ${baby.name}`}
        pageSubtitle={`Ask Somni anything about ${baby.name}'s sleep.`}
        billingEnabled={billingEnabled}
        hasPremiumAccess={hasPremiumAccess(subscription)}
        isReadOnly={isReadOnly}
        billingDegradedReason={billingDegradedReason}
      />
    </main>
  )
}
