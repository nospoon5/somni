import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteByEndpoint: vi.fn(),
  deleteByProfile: vi.fn(),
  deleteSubscription: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { DELETE, POST } from './route'

const endpoint = 'https://push.example.test/subscriptions/browser-1'
const subscription = {
  endpoint,
  keys: {
    p256dh: 'a'.repeat(87),
    auth: 'b'.repeat(22),
  },
}

function request(method: 'POST' | 'DELETE', body: unknown) {
  return new Request('https://somni.test/api/notifications/subscribe', {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'Somni test browser' },
    body: JSON.stringify(body),
  })
}

describe('notification subscription route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getUser.mockResolvedValue({ data: { user: { id: 'current-profile' } } })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    })
    mocks.from.mockReturnValue({
      upsert: mocks.upsert,
      delete: mocks.deleteSubscription,
    })
    mocks.upsert.mockResolvedValue({ error: null })
    mocks.deleteSubscription.mockReturnValue({ eq: mocks.deleteByProfile })
    mocks.deleteByProfile.mockReturnValue({ eq: mocks.deleteByEndpoint })
    mocks.deleteByEndpoint.mockResolvedValue({ error: null })
  })

  it('stores a subscription against the authenticated profile only', async () => {
    const response = await POST(request('POST', subscription))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ subscribed: true })
    expect(mocks.from).toHaveBeenCalledWith('push_subscriptions')
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 'current-profile',
        endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }),
      { onConflict: 'endpoint' }
    )
  })

  it('requires an authenticated user before saving a browser endpoint', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(request('POST', subscription))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes only the current profile subscription', async () => {
    const response = await DELETE(request('DELETE', { endpoint }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ unsubscribed: true })
    expect(mocks.deleteByProfile).toHaveBeenCalledWith('profile_id', 'current-profile')
    expect(mocks.deleteByEndpoint).toHaveBeenCalledWith('endpoint', endpoint)
  })
})
