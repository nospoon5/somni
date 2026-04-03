import { createClient } from '@/lib/supabase/server'
import {
  ensureStripeCustomerForProfile,
  ensureSubscriptionRecord,
  hasPremiumAccess,
} from '@/lib/billing/subscriptions'
import {
  getAppUrl,
  getStripe,
  getStripePriceId,
  hasCheckoutConfiguration,
  type CheckoutPlan,
} from '@/lib/billing/stripe'

type CheckoutRequestBody = {
  plan?: unknown
}

function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return value === 'monthly' || value === 'annual'
}

export async function POST(request: Request) {
  if (!hasCheckoutConfiguration()) {
    return Response.json(
      { error: 'Stripe checkout is not configured yet.' },
      { status: 503 }
    )
  }

  let body: CheckoutRequestBody

  try {
    body = (await request.json()) as CheckoutRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isCheckoutPlan(body.plan)) {
    return Response.json({ error: 'Please choose a valid billing plan.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const subscription = await ensureSubscriptionRecord({
    profileId: user.id,
    email: user.email,
  })

  if (hasPremiumAccess(subscription)) {
    return Response.json(
      { error: 'This account already has premium access. Open billing settings instead.' },
      { status: 409 }
    )
  }

  const customerId = await ensureStripeCustomerForProfile({
    profileId: user.id,
    email: user.email,
    fullName: profile?.full_name ?? null,
    existingCustomerId: subscription.stripe_customer_id,
  })

  const priceId = getStripePriceId(body.plan)
  if (!priceId) {
    return Response.json(
      { error: 'The selected Stripe price has not been configured yet.' },
      { status: 503 }
    )
  }

  const stripe = getStripe()
  const appUrl = getAppUrl()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl}/chat?billing=success`,
    cancel_url: `${appUrl}/chat?billing=canceled`,
    metadata: {
      profile_id: user.id,
      selected_plan: body.plan,
    },
    subscription_data: {
      metadata: {
        profile_id: user.id,
        selected_plan: body.plan,
      },
    },
  })

  return Response.json({ url: session.url })
}
