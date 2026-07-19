import { redirect } from 'next/navigation'
import { ChatCoach } from '@/components/chat/ChatCoach'
import { BabySwitcher } from '@/components/babies/BabySwitcher'
import { readActiveBabyId, resolveActiveBaby } from '@/lib/babies/active-baby'
import { createClient } from '@/lib/supabase/server'
import {
  ensureSubscriptionRecord,
  hasPremiumAccess,
  type SubscriptionRecord,
} from '@/lib/billing/subscriptions'
import { sanitizeTimezone } from '@/lib/billing/usage'
import { getDateStringForTimezone } from '@/lib/date-utils'
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
    .select('onboarding_completed, timezone')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const timezone = sanitizeTimezone(profile.timezone)
  const todayPlanDate = getDateStringForTimezone(timezone)

  const preferredBabyId = await readActiveBabyId()
  const { data: babies } = await supabase
    .from('babies')
    .select('id, name')
    .order('created_at', { ascending: true })
  const baby = resolveActiveBaby(babies ?? [], preferredBabyId)

  if (!baby) {
    redirect('/onboarding')
  }

  // Load preferences, latest log, and daily plan for context-aware prompt starters.
  const [prefRes, planRes, latestLogRes] = await Promise.all([
    supabase
      .from('onboarding_preferences')
      .select('sleep_style_label')
      .eq('baby_id', baby.id)
      .maybeSingle(),
    supabase
      .from('daily_plans')
      .select('pending_rescue_targets, rescue_dismissed')
      .eq('baby_id', baby.id)
      .eq('plan_date', todayPlanDate)
      .maybeSingle(),
    supabase
      .from('sleep_logs')
      .select('id, started_at, ended_at, is_night')
      .eq('baby_id', baby.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const sleepStyle = prefRes.data?.sleep_style_label || 'balanced'
  const hasPendingRescue = Boolean(
    planRes.data?.pending_rescue_targets && !planRes.data.rescue_dismissed
  )

  const latestLog = latestLogRes.data
  const activeSleep = latestLog && !latestLog.ended_at ? {
    id: latestLog.id,
    startedAt: latestLog.started_at,
  } : null

  const lastCompletedSleep = latestLog && latestLog.ended_at ? {
    startedAt: latestLog.started_at,
    endedAt: latestLog.ended_at,
    isNight: latestLog.is_night,
  } : null

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
      <BabySwitcher
        babies={babies ?? []}
        activeBabyId={baby.id}
        returnTo="/chat"
      />
      <ChatCoach
        profileId={user.id}
        babyId={baby.id}
        babyName={baby.name}
        pageEyebrow="Chat"
        pageTitle={`Sleep coaching for ${baby.name}`}
        pageSubtitle={`Ask Somni anything about ${baby.name}'s sleep.`}
        billingEnabled={billingEnabled}
        hasPremiumAccess={hasPremiumAccess(subscription)}
        isReadOnly={isReadOnly}
        billingDegradedReason={billingDegradedReason}
        currentState={{
          sleepStyle,
          hasPendingRescue,
          activeSleep,
          lastCompletedSleep,
        }}
      />
    </main>
  )
}
