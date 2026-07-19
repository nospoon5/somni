import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createSupportTicket: vi.fn(),
  getRecentTicketCount: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/repositories/support', () => ({
  createSupportTicket: mocks.createSupportTicket,
  getRecentTicketCount: mocks.getRecentTicketCount,
}))
vi.mock('@/lib/observability/logger', () => ({
  createRequestLogger: () => ({
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
  }),
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/support', () => {
  const userClient = {
    auth: {
      getUser: vi.fn(),
    },
  }
  const adminClient = { kind: 'admin' }

  beforeEach(() => {
    vi.clearAllMocks()
    userClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'profile-1', email: 'parent@example.com' } },
    })
    mocks.createClient.mockResolvedValue(userClient)
    mocks.createAdminClient.mockReturnValue(adminClient)
    mocks.getRecentTicketCount.mockResolvedValue({ count: 0, error: null })
    mocks.createSupportTicket.mockResolvedValue({ error: null })
  })

  it('rejects unauthenticated submissions', async () => {
    userClient.auth.getUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(request({ category: 'bug', message: 'A useful description.' }))

    expect(response.status).toBe(401)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('fails closed when the rate-limit count cannot be verified', async () => {
    const countError = new Error('count unavailable')
    mocks.getRecentTicketCount.mockResolvedValue({ count: null, error: countError })

    const response = await POST(request({ category: 'bug', message: 'A useful description.' }))

    expect(response.status).toBe(503)
    expect(mocks.createSupportTicket).not.toHaveBeenCalled()
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to get recent ticket count',
      { userId: 'profile-1' },
      countError,
      true,
    )
  })

  it('enforces the five-ticket hourly limit', async () => {
    mocks.getRecentTicketCount.mockResolvedValue({ count: 5, error: null })

    const response = await POST(request({ category: 'billing', message: 'A useful description.' }))

    expect(response.status).toBe(429)
    expect(mocks.createSupportTicket).not.toHaveBeenCalled()
  })

  it('stores a valid request without returning an internal ticket id', async () => {
    const response = await POST(
      request({
        category: 'feedback',
        message: '  A useful description of the issue.  ',
        originPage: '/dashboard',
        supportPage: '/support',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.getRecentTicketCount).toHaveBeenCalledWith(adminClient, 'profile-1', 1)
    expect(mocks.createSupportTicket).toHaveBeenCalledWith(
      userClient,
      expect.objectContaining({
        profile_id: 'profile-1',
        category: 'feedback',
        message: 'A useful description of the issue.',
        origin_page: '/dashboard',
      }),
    )
  })

  it('returns a non-sensitive error when persistence fails', async () => {
    const insertError = new Error('database details')
    mocks.createSupportTicket.mockResolvedValue({ error: insertError })

    const response = await POST(request({ category: 'bug', message: 'A useful description.' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to submit support request. Please try again.',
    })
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to insert support ticket',
      { userId: 'profile-1', category: 'bug' },
      insertError,
      true,
    )
  })
})
