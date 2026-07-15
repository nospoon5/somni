import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn(),
  select: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: (callback: unknown) => callback,
  }
})

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { requireAdmin } from './guard'

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`)
    })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    })
  })

  it('returns the authenticated administrator ID', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user-id' } },
      error: null,
    })
    mocks.maybeSingle.mockResolvedValue({
      data: { is_admin: true },
      error: null,
    })

    await expect(requireAdmin()).resolves.toEqual({ userId: 'admin-user-id' })
    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(mocks.select).toHaveBeenCalledWith('is_admin')
    expect(mocks.eq).toHaveBeenCalledWith('id', 'admin-user-id')
  })

  it('redirects when there is no authenticated user', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await expect(requireAdmin()).rejects.toThrow('redirect:/dashboard')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('redirects a signed-in non-admin user', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'regular-user-id' } },
      error: null,
    })
    mocks.maybeSingle.mockResolvedValue({
      data: { is_admin: false },
      error: null,
    })

    await expect(requireAdmin()).rejects.toThrow('redirect:/dashboard')
  })

  it('fails closed when the profile lookup fails', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user-id' } },
      error: null,
    })
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('database unavailable'),
    })

    await expect(requireAdmin()).rejects.toThrow('redirect:/dashboard')
  })
})

