import 'server-only'

import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export type CheckoutPlan = 'monthly' | 'annual'

export function getStripe() {
  if (stripeClient) {
    return stripeClient
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  stripeClient = new Stripe(secretKey)
  return stripeClient
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function hasCheckoutConfiguration() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_ANNUAL
  )
}

export function getStripePriceId(plan: CheckoutPlan) {
  if (plan === 'monthly') {
    return process.env.STRIPE_PRICE_MONTHLY ?? ''
  }

  return process.env.STRIPE_PRICE_ANNUAL ?? ''
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET ?? ''
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
}
