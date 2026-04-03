import type Stripe from 'stripe'
import { getStripe, getStripeWebhookSecret, isStripeConfigured } from '@/lib/billing/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSubscriptionFromStripe } from '@/lib/billing/subscriptions'

function getProfileIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  const clientReferenceId =
    typeof session.client_reference_id === 'string' ? session.client_reference_id : null
  const metadataProfileId =
    typeof session.metadata?.profile_id === 'string' ? session.metadata.profile_id : null

  return clientReferenceId || metadataProfileId
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const admin = createAdminClient()
  const profileId = getProfileIdFromCheckoutSession(session)
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

  if (profileId && customerId) {
    await admin.from('subscriptions').upsert(
      {
        profile_id: profileId,
        stripe_customer_id: customerId,
      },
      { onConflict: 'profile_id' }
    )
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null

  if (!subscriptionId) {
    return
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await syncSubscriptionFromStripe(subscription, profileId)
}

export async function POST(request: Request) {
  const webhookSecret = getStripeWebhookSecret()
  if (!isStripeConfigured() || !webhookSecret) {
    return Response.json(
      { error: 'Stripe webhook handling is not configured yet.' },
      { status: 503 }
    )
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing Stripe signature header.' }, { status: 400 })
  }

  const payload = await request.text()
  const stripe = getStripe()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe signature'
    return Response.json({ error: message }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription)
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Stripe webhook processing failed unexpectedly'
    return Response.json({ error: message }, { status: 500 })
  }

  return Response.json({ received: true })
}
