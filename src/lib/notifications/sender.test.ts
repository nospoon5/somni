import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteSubscription: vi.fn(),
  deleteWhere: vi.fn(),
  from: vi.fn(),
  insertLog: vi.fn(),
  maybeSingle: vi.fn(),
  profileWhere: vi.fn(),
  selectProfile: vi.fn(),
  selectSubscriptions: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  subscriptionWhere: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mocks.from }),
}))

vi.mock('web-push', () => ({
  default: {
    sendNotification: mocks.sendNotification,
    setVapidDetails: mocks.setVapidDetails,
  },
}))

import {
  isExpiredPushSubscriptionError,
  isWithinSuppressionWindow,
  sendNotificationToUser,
} from './sender'

describe('notification sender helpers', () => {
  it('handles quiet hours that pass midnight', () => {
    expect(isWithinSuppressionWindow(22, 0, '19:00', '06:00')).toBe(true)
    expect(isWithinSuppressionWindow(5, 59, '19:00', '06:00')).toBe(true)
    expect(isWithinSuppressionWindow(6, 0, '19:00', '06:00')).toBe(false)
    expect(isWithinSuppressionWindow(12, 0, '19:00', '06:00')).toBe(false)
  })

  it('recognises only gone push subscriptions as safe to remove', () => {
    expect(isExpiredPushSubscriptionError({ statusCode: 404 })).toBe(true)
    expect(isExpiredPushSubscriptionError({ statusCode: 410 })).toBe(true)
    expect(isExpiredPushSubscriptionError({ statusCode: 500 })).toBe(false)
    expect(isExpiredPushSubscriptionError(new Error('network unavailable'))).toBe(false)
  })
})

describe('sendNotificationToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public-key-for-test'
    process.env.VAPID_PRIVATE_KEY = 'private-key-for-test'

    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mocks.selectProfile,
        }
      }

      if (table === 'notification_logs') {
        return {
          insert: mocks.insertLog,
        }
      }

      return {
        delete: mocks.deleteSubscription,
        select: mocks.selectSubscriptions,
      }
    })
    mocks.selectProfile.mockReturnValue({ eq: mocks.profileWhere })
    mocks.profileWhere.mockReturnValue({ maybeSingle: mocks.maybeSingle })
    mocks.maybeSingle.mockResolvedValue({
      data: {
        push_enabled: true,
        in_app_feed_enabled: true,
        night_suppression_enabled: false,
        suppression_start: '19:00',
        suppression_end: '06:00',
        timezone: 'Australia/Sydney',
      },
      error: null,
    })
    mocks.insertLog.mockResolvedValue({ error: null })
    mocks.selectSubscriptions.mockReturnValue({ eq: mocks.subscriptionWhere })
    mocks.subscriptionWhere.mockResolvedValue({
      data: [
        {
          endpoint: 'https://push.example.test/expired-browser',
          p256dh: 'p256dh-key',
          auth: 'auth-key',
        },
      ],
      error: null,
    })
    mocks.deleteSubscription.mockReturnValue({ eq: mocks.deleteWhere })
    mocks.deleteWhere.mockResolvedValue({ error: null })
  })

  it('keeps the feed entry and removes an expired browser subscription', async () => {
    mocks.sendNotification.mockRejectedValue({ statusCode: 410 })

    const result = await sendNotificationToUser(
      'caregiver-profile',
      'Sleep Session Update',
      'A sleep session started.',
      new Date('2026-07-15T02:00:00.000Z')
    )

    expect(result).toEqual({
      feedLogged: true,
      pushSuppressed: false,
      sentSubscriptions: 0,
      removedSubscriptions: 1,
      failedSubscriptions: 0,
    })
    expect(mocks.insertLog).toHaveBeenCalledWith({
      profile_id: 'caregiver-profile',
      title: 'Sleep Session Update',
      body: 'A sleep session started.',
    })
    expect(mocks.deleteWhere).toHaveBeenCalledWith(
      'endpoint',
      'https://push.example.test/expired-browser'
    )
  })
})
