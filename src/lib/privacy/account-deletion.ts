import 'server-only'

import type Stripe from 'stripe'
import { getStripe } from '@/lib/billing/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

type AccountDeletionInput = {
  userId: string
  email: string | null | undefined
}

export type AccountDeletionStore = {
  getStripeBillingReference(profileId: string): Promise<StripeBillingReference>
  deletePendingEmailInvites(email: string): Promise<void>
  deleteAuthUser(userId: string): Promise<void>
}

export type StripeBillingReference = {
  customerId: string | null
  subscriptionId: string | null
  status: string | null
}

type StripeAccountCleaner = {
  deleteBilling(reference: StripeBillingReference): Promise<void>
}

function isMissingStripeResource(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: unknown; statusCode?: unknown }
  return candidate.code === 'resource_missing' || candidate.statusCode === 404
}

export function createStripeAccountCleaner(stripe: Stripe): StripeAccountCleaner {
  return {
    async deleteBilling(reference) {
      let customerId = reference.customerId

      if (reference.subscriptionId) {
        let subscription: Stripe.Subscription | null = null
        try {
          subscription = await stripe.subscriptions.retrieve(reference.subscriptionId)
        } catch (error) {
          if (!isMissingStripeResource(error)) {
            throw error
          }
        }

        if (subscription) {
          const subscriptionCustomerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id ?? null

          if (customerId && subscriptionCustomerId && customerId !== subscriptionCustomerId) {
            throw new Error('Stored Stripe customer and subscription do not match.')
          }

          customerId = customerId ?? subscriptionCustomerId

          if (!customerId && subscription.status !== 'canceled') {
            await stripe.subscriptions.cancel(subscription.id)
          }
        }
      }

      if (!customerId) {
        return
      }

      let customer: Stripe.Customer | Stripe.DeletedCustomer

      try {
        customer = await stripe.customers.retrieve(customerId)
      } catch (error) {
        // A retry after a completed deletion is safe and should not strand the auth account.
        if (isMissingStripeResource(error)) {
          return
        }
        throw error
      }

      if (customer.deleted) {
        return
      }

      // Stripe's customer deletion immediately cancels every active subscription for it.
      await stripe.customers.del(customerId)
    },
  }
}

export async function runAccountDeletion(
  input: AccountDeletionInput,
  store: AccountDeletionStore,
  stripeCleaner: StripeAccountCleaner | null
): Promise<void> {
  const billingReference = await store.getStripeBillingReference(input.userId)

  if (
    !billingReference.customerId &&
    !billingReference.subscriptionId &&
    billingReference.status &&
    !['inactive', 'canceled'].includes(billingReference.status)
  ) {
    throw new Error('Live billing state exists without Stripe identifiers.')
  }

  if (input.email) {
    await store.deletePendingEmailInvites(input.email.trim().toLowerCase())
  }

  if (billingReference.customerId || billingReference.subscriptionId) {
    if (!stripeCleaner) {
      throw new Error('Stripe billing cleanup is unavailable.')
    }
    await stripeCleaner.deleteBilling(billingReference)
  }

  // Auth deletion comes last. Database cascades must never run while billing is still active.
  await store.deleteAuthUser(input.userId)
}

function createSupabaseAccountDeletionStore(): AccountDeletionStore {
  const admin = createAdminClient()

  return {
    async getStripeBillingReference(profileId) {
      const { data, error } = await admin
        .from('subscriptions')
        .select('stripe_customer_id, stripe_subscription_id, status')
        .eq('profile_id', profileId)
        .maybeSingle()

      if (error) {
        throw new Error(`Could not read billing state: ${error.message}`)
      }

      return {
        customerId:
          typeof data?.stripe_customer_id === 'string' ? data.stripe_customer_id : null,
        subscriptionId:
          typeof data?.stripe_subscription_id === 'string' ? data.stripe_subscription_id : null,
        status: typeof data?.status === 'string' ? data.status : null,
      }
    },

    async deletePendingEmailInvites(email) {
      const { error } = await admin
        .from('baby_shares')
        .delete()
        .eq('email', email)
        .eq('status', 'pending')
        .is('profile_id', null)

      if (error) {
        throw new Error(`Could not remove pending invitations: ${error.message}`)
      }
    },

    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) {
        throw new Error(`Could not delete authentication account: ${error.message}`)
      }
    },
  }
}

export async function deleteAccountAndData(input: AccountDeletionInput): Promise<void> {
  const store = createSupabaseAccountDeletionStore()
  const billingReference = await store.getStripeBillingReference(input.userId)

  // Delay Stripe initialization so free accounts can still be deleted in environments
  // where billing has intentionally not been configured.
  const stripeCleaner =
    billingReference.customerId || billingReference.subscriptionId
      ? createStripeAccountCleaner(getStripe())
      : null

  const storeWithCachedCustomer: AccountDeletionStore = {
    ...store,
    getStripeBillingReference: async () => billingReference,
  }

  await runAccountDeletion(input, storeWithCachedCustomer, stripeCleaner)
}
