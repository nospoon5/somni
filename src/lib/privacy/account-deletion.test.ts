import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

vi.mock('server-only', () => ({}))

import {
  createStripeAccountCleaner,
  runAccountDeletion,
  type AccountDeletionStore,
} from './account-deletion'

describe('account deletion orchestration', () => {
  let calls: string[]
  let store: AccountDeletionStore

  beforeEach(() => {
    calls = []
    store = {
      getStripeBillingReference: vi.fn(async () => {
        calls.push('read-billing')
        return { customerId: 'cus_test', subscriptionId: 'sub_test', status: 'active' }
      }),
      deletePendingEmailInvites: vi.fn(async () => {
        calls.push('delete-pending-invites')
      }),
      deleteAuthUser: vi.fn(async () => {
        calls.push('delete-auth-user')
      }),
    }
  })

  it('removes pending invites and billing before deleting the auth account', async () => {
    const cleaner = {
      deleteBilling: vi.fn(async () => {
        calls.push('delete-stripe-customer')
      }),
    }

    await runAccountDeletion(
      { userId: 'profile-1', email: ' Parent@Example.com ' },
      store,
      cleaner
    )

    expect(calls).toEqual([
      'read-billing',
      'delete-pending-invites',
      'delete-stripe-customer',
      'delete-auth-user',
    ])
    expect(store.deletePendingEmailInvites).toHaveBeenCalledWith('parent@example.com')
  })

  it('deletes a free account safely when its profile or billing row is missing', async () => {
    vi.mocked(store.getStripeBillingReference).mockResolvedValue({
      customerId: null,
      subscriptionId: null,
      status: null,
    })

    await runAccountDeletion({ userId: 'profile-1', email: null }, store, null)

    expect(store.deletePendingEmailInvites).not.toHaveBeenCalled()
    expect(store.deleteAuthUser).toHaveBeenCalledWith('profile-1')
  })

  it('fails closed and keeps auth when Stripe cleanup fails', async () => {
    const cleaner = {
      deleteBilling: vi.fn(async () => {
        throw new Error('Stripe unavailable')
      }),
    }

    await expect(
      runAccountDeletion({ userId: 'profile-1', email: 'parent@example.com' }, store, cleaner)
    ).rejects.toThrow('Stripe unavailable')

    expect(store.deleteAuthUser).not.toHaveBeenCalled()
  })

  it('fails closed when a billing customer exists but Stripe is not configured', async () => {
    await expect(
      runAccountDeletion({ userId: 'profile-1', email: null }, store, null)
    ).rejects.toThrow('Stripe billing cleanup is unavailable')

    expect(store.deleteAuthUser).not.toHaveBeenCalled()
  })

  it('fails closed when live billing state has lost both Stripe identifiers', async () => {
    vi.mocked(store.getStripeBillingReference).mockResolvedValue({
      customerId: null,
      subscriptionId: null,
      status: 'active',
    })

    await expect(
      runAccountDeletion({ userId: 'profile-1', email: null }, store, null)
    ).rejects.toThrow('Live billing state exists without Stripe identifiers')

    expect(store.deleteAuthUser).not.toHaveBeenCalled()
  })
})

describe('Stripe account cleanup', () => {
  it('deletes a live customer, which immediately cancels its subscriptions', async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: 'cus_test', deleted: false })
    const del = vi.fn().mockResolvedValue({ id: 'cus_test', deleted: true })
    const retrieveSubscription = vi.fn().mockResolvedValue({
      id: 'sub_test',
      customer: 'cus_test',
      status: 'active',
    })
    const cancel = vi.fn()
    const stripe = {
      customers: { retrieve, del },
      subscriptions: { retrieve: retrieveSubscription, cancel },
    } as unknown as Stripe

    await createStripeAccountCleaner(stripe).deleteBilling({
      customerId: 'cus_test',
      subscriptionId: 'sub_test',
      status: 'active',
    })

    expect(retrieve).toHaveBeenCalledWith('cus_test')
    expect(del).toHaveBeenCalledWith('cus_test')
    expect(cancel).not.toHaveBeenCalled()
  })

  it('is idempotent when the Stripe customer was already deleted', async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: 'cus_test', deleted: true })
    const del = vi.fn()
    const stripe = {
      customers: { retrieve, del },
      subscriptions: { retrieve: vi.fn() },
    } as unknown as Stripe

    await createStripeAccountCleaner(stripe).deleteBilling({
      customerId: 'cus_test',
      subscriptionId: null,
      status: 'canceled',
    })

    expect(del).not.toHaveBeenCalled()
  })

  it('treats Stripe resource_missing as an already-completed deletion', async () => {
    const retrieve = vi.fn().mockRejectedValue({ code: 'resource_missing', statusCode: 404 })
    const del = vi.fn()
    const stripe = {
      customers: { retrieve, del },
      subscriptions: { retrieve: vi.fn() },
    } as unknown as Stripe

    await createStripeAccountCleaner(stripe).deleteBilling({
      customerId: 'cus_test',
      subscriptionId: null,
      status: 'canceled',
    })

    expect(del).not.toHaveBeenCalled()
  })

  it('resolves a customer from a subscription-only billing record', async () => {
    const retrieveCustomer = vi.fn().mockResolvedValue({ id: 'cus_from_sub', deleted: false })
    const deleteCustomer = vi.fn().mockResolvedValue({ id: 'cus_from_sub', deleted: true })
    const retrieveSubscription = vi.fn().mockResolvedValue({
      id: 'sub_only',
      customer: 'cus_from_sub',
      status: 'active',
    })
    const stripe = {
      customers: { retrieve: retrieveCustomer, del: deleteCustomer },
      subscriptions: { retrieve: retrieveSubscription, cancel: vi.fn() },
    } as unknown as Stripe

    await createStripeAccountCleaner(stripe).deleteBilling({
      customerId: null,
      subscriptionId: 'sub_only',
      status: 'active',
    })

    expect(deleteCustomer).toHaveBeenCalledWith('cus_from_sub')
  })
})
