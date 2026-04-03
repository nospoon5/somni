import { createClient } from '@/lib/supabase/server'
import { ensureSubscriptionRecord } from '@/lib/billing/subscriptions'
import { getAppUrl, getStripe, isStripeConfigured } from '@/lib/billing/stripe'

export async function POST() {
  if (!isStripeConfigured()) {
    return Response.json(
      { error: 'Stripe billing is not configured yet.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subscription = await ensureSubscriptionRecord({
    profileId: user.id,
    email: user.email ?? null,
  })

  if (!subscription.stripe_customer_id) {
    return Response.json(
      { error: 'A Stripe billing account was not found for this profile yet.' },
      { status: 409 }
    )
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${getAppUrl()}/chat`,
  })

  return Response.json({ url: session.url })
}
