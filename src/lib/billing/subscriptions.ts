import 'server-only'

import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/billing/stripe'
import { logger } from '@/lib/observability/logger'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type SubscriptionPlan = 'free' | 'monthly' | 'annual'
export type SubscriptionStatus = 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled'

export type SubscriptionRecord = {
  profile_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_end: string | null
  is_trial: boolean
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

function isMissingStripeResource(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: unknown; statusCode?: unknown }
  return candidate.code === 'resource_missing' || candidate.statusCode === 404
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'trialing') {
    return 'trialing'
  }

  if (status === 'active') {
    return 'active'
  }

  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') {
    return 'past_due'
  }

  if (status === 'canceled') {
    return 'canceled'
  }

  return 'inactive'
}

function getPlanFromStripeSubscription(subscription: Stripe.Subscription): SubscriptionPlan {
  const item = subscription.items.data[0]
  const interval = item?.price?.recurring?.interval

  if (interval === 'year') {
    return 'annual'
  }

  if (interval === 'month') {
    return 'monthly'
  }

  return 'free'
}

export function hasPremiumAccess(subscription: Pick<SubscriptionRecord, 'plan' | 'status'> | null) {
  if (!subscription) {
    return false
  }

  if (subscription.plan === 'free') {
    return false
  }

  return subscription.status === 'active' || subscription.status === 'trialing'
}

function buildFreeSubscriptionFallback(profileId: string): SubscriptionRecord {
  return {
    profile_id: profileId,
    plan: 'free',
    status: 'inactive',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
    is_trial: false,
  }
}

/**
 * Read subscription state without creating a database row.
 *
 * Evaluation traffic uses this path so a benchmark cannot mutate an approved
 * test account simply because an optional subscription row is missing.
 */
export async function readSubscriptionRecord(input: {
  profileId: string
}): Promise<SubscriptionRecord> {
  const fallbackRecord = buildFreeSubscriptionFallback(input.profileId)
  const admin = createAdminClient()

  try {
    const { data, error } = await admin
      .from('subscriptions')
      .select(
        'profile_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, is_trial'
      )
      .eq('profile_id', input.profileId)
      .maybeSingle()

    if (error) {
      logger.error(
        'Failed to load subscription state',
        { profileId: input.profileId },
        new Error(error.message)
      )
      return fallbackRecord
    }

    return data ? (data as SubscriptionRecord) : fallbackRecord
  } catch (err) {
    logger.error(
      'Unexpected error reading subscription state',
      { profileId: input.profileId },
      err instanceof Error ? err : new Error(String(err))
    )
    return fallbackRecord
  }
}

export async function ensureSubscriptionRecord(input: {
  profileId: string
  email?: string | null
}): Promise<SubscriptionRecord> {
  const admin = createAdminClient()

  const fallbackRecord = buildFreeSubscriptionFallback(input.profileId)

  try {
    const { data: existing, error: existingError } = await admin
      .from('subscriptions')
      .select(
        'profile_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, is_trial'
      )
      .eq('profile_id', input.profileId)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load subscription state', { profileId: input.profileId }, new Error(existingError.message))
      return fallbackRecord
    }

    if (existing) {
      return existing as SubscriptionRecord
    }

    const { data, error } = await admin
      .from('subscriptions')
      .insert({
        profile_id: input.profileId,
        plan: 'free',
        status: 'inactive',
      })
      .select(
        'profile_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, is_trial'
      )
      .single()

    if (error) {
      logger.error('Failed to create subscription state', { profileId: input.profileId }, new Error(error.message))
      return fallbackRecord
    }

    return data as SubscriptionRecord
  } catch (err) {
    logger.error('Unexpected error ensuring subscription record', { profileId: input.profileId }, err instanceof Error ? err : new Error(String(err)))
    return fallbackRecord
  }
}

export async function ensureStripeCustomerForProfile(input: {
  profileId: string
  email: string
  fullName?: string | null
  existingCustomerId?: string | null
}) {
  if (input.existingCustomerId) {
    return input.existingCustomerId
  }

  const stripe = getStripe()
  const admin = createAdminClient()
  const customer = await stripe.customers.create({
    email: input.email,
    name: input.fullName ?? undefined,
    metadata: {
      profile_id: input.profileId,
    },
  })

  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        profile_id: input.profileId,
        stripe_customer_id: customer.id,
      },
      { onConflict: 'profile_id' }
    )

  if (error) {
    throw new Error(`Failed to store Stripe customer id: ${error.message}`)
  }

  return customer.id
}

async function resolveProfileIdForStripeEvent(
  subscription: Stripe.Subscription,
  fallbackProfileId?: string | null
) {
  if (isUuid(fallbackProfileId)) {
    return fallbackProfileId
  }

  const metadataProfileId = subscription.metadata?.profile_id
  if (isUuid(metadataProfileId)) {
    return metadataProfileId
  }

  const admin = createAdminClient()
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

  if (subscription.id) {
    const { data: bySubscription } = await admin
      .from('subscriptions')
      .select('profile_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    if (isUuid(bySubscription?.profile_id)) {
      return bySubscription.profile_id
    }
  }

  if (customerId) {
    const { data: byCustomer } = await admin
      .from('subscriptions')
      .select('profile_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (isUuid(byCustomer?.profile_id)) {
      return byCustomer.profile_id
    }

    const stripe = getStripe()
    let customer: Stripe.Customer | Stripe.DeletedCustomer
    try {
      customer = await stripe.customers.retrieve(customerId)
    } catch (error) {
      if (isMissingStripeResource(error)) {
        return null
      }
      throw error
    }
    if (!customer.deleted && isUuid(customer.metadata?.profile_id)) {
      return customer.metadata.profile_id
    }
  }

  return null
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  fallbackProfileId?: string | null,
  eventTimestamp?: number
) {
  const admin = createAdminClient()
  const profileId = await resolveProfileIdForStripeEvent(subscription, fallbackProfileId)

  if (!profileId) {
    // Customer deletion can race its final subscription.deleted webhook. Once the
    // local profile has cascaded away, that canceled event is already reconciled.
    if (subscription.status === 'canceled') {
      logger.info('Ignoring canceled Stripe subscription with no local profile', {
        subscriptionId: subscription.id,
      })
      return null
    }
    throw new Error(`Unable to resolve profile for Stripe subscription ${subscription.id}`)
  }

  if (eventTimestamp) {
    const { data: existing } = await admin
      .from('subscriptions')
      .select('updated_at')
      .eq('profile_id', profileId)
      .maybeSingle()

    if (existing && existing.updated_at) {
      const dbUpdated = new Date(existing.updated_at).getTime()
      // If the Stripe event was created before the last DB update (with 5s buffer), ignore it
      if (eventTimestamp * 1000 < dbUpdated - 5000) {
        logger.warn('Ignoring out-of-order Stripe webhook event', { profileId, subscriptionId: subscription.id, eventTimestamp, dbUpdated })
        return null // Ignore the update
      }
    }
  }

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end ?? null

  const payload = {
    profile_id: profileId,
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscription.id,
    plan: getPlanFromStripeSubscription(subscription),
    status: mapStripeStatus(subscription.status),
    current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null,
    is_trial:
      subscription.status === 'trialing' ||
      (typeof subscription.trial_end === 'number' && subscription.trial_end * 1000 > Date.now()),
  }

  const { data, error } = await admin
    .from('subscriptions')
    .upsert(payload, { onConflict: 'profile_id' })
    .select(
      'profile_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, is_trial'
    )
    .single()

  if (error) {
    throw new Error(`Failed to sync subscription state: ${error.message}`)
  }

  return data as SubscriptionRecord
}
