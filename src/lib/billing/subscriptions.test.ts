import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  retrieveCustomer: vi.fn(),
  loggerInfo: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mocks.from }),
}))
vi.mock('@/lib/billing/stripe', () => ({
  getStripe: () => ({ customers: { retrieve: mocks.retrieveCustomer } }),
}))
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { readSubscriptionRecord, syncSubscriptionFromStripe } from './subscriptions'

function makeSubscription(status: Stripe.Subscription.Status): Stripe.Subscription {
  return {
    id: 'sub_deleted',
    status,
    customer: 'cus_deleted',
    metadata: {},
    items: { data: [] },
  } as unknown as Stripe.Subscription
}

describe('Stripe webhook reconciliation after account deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mocks.from.mockReturnValue(chain)
    mocks.retrieveCustomer.mockResolvedValue({ id: 'cus_deleted', deleted: true })
  })

  it('acknowledges a final canceled event when its local profile is already gone', async () => {
    await expect(syncSubscriptionFromStripe(makeSubscription('canceled'))).resolves.toBeNull()
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Ignoring canceled Stripe subscription with no local profile',
      { subscriptionId: 'sub_deleted' }
    )
  })

  it('still fails closed for an active subscription that cannot be linked to a profile', async () => {
    await expect(syncSubscriptionFromStripe(makeSubscription('active'))).rejects.toThrow(
      'Unable to resolve profile for Stripe subscription sub_deleted'
    )
  })

  it('handles a Stripe customer already removed before the canceled webhook is processed', async () => {
    mocks.retrieveCustomer.mockRejectedValue({ code: 'resource_missing', statusCode: 404 })

    await expect(syncSubscriptionFromStripe(makeSubscription('canceled'))).resolves.toBeNull()
  })
})

describe('read-only subscription lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an in-memory free fallback without inserting when no row exists', async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn(),
    }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mocks.from.mockReturnValue(chain)

    await expect(readSubscriptionRecord({ profileId: 'profile-1' })).resolves.toMatchObject({
      profile_id: 'profile-1',
      plan: 'free',
      status: 'inactive',
    })
    expect(chain.insert).not.toHaveBeenCalled()
  })
})
