import 'server-only'

import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_PROFILE_TIMEZONE = 'Australia/Sydney'
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

type NotificationPreferences = {
  push_enabled: boolean
  in_app_feed_enabled: boolean
  night_suppression_enabled: boolean
  suppression_start: string
  suppression_end: string
  timezone: string
}

type PushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

export type NotificationSendResult = {
  feedLogged: boolean
  pushSuppressed: boolean
  sentSubscriptions: number
  removedSubscriptions: number
  failedSubscriptions: number
}

export type NotificationSendOptions = {
  includeFeed?: boolean
  includePush?: boolean
  now?: Date
}

function sanitizeTimezone(value: string | null | undefined) {
  const candidate = value?.trim()
  if (!candidate) return DEFAULT_PROFILE_TIMEZONE

  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_PROFILE_TIMEZONE
  }
}

function minutesSinceMidnight(value: string | null | undefined) {
  if (!value || !TIME_PATTERN.test(value)) return null

  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function isWithinSuppressionWindow(
  localHour: number,
  localMinute: number,
  suppressionStart: string | null | undefined,
  suppressionEnd: string | null | undefined
) {
  const start = minutesSinceMidnight(suppressionStart)
  const end = minutesSinceMidnight(suppressionEnd)
  const current = localHour * 60 + localMinute

  if (start === null || end === null || start === end) return false

  return start < end ? current >= start && current < end : current >= start || current < end
}

function localTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: sanitizeTimezone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return { hour: readPart('hour'), minute: readPart('minute') }
}

export function isExpiredPushSubscriptionError(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return false

  const statusCode = (error as { statusCode?: unknown }).statusCode
  return statusCode === 404 || statusCode === 410
}

let configuredVapidKey: string | null = null

function isWebPushConfigured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) return false

  const configurationKey = `${publicKey}:${privateKey}`
  if (configuredVapidKey !== configurationKey) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:support@somni.app',
      publicKey,
      privateKey
    )
    configuredVapidKey = configurationKey
  }

  return true
}

export async function sendNotificationToUser(
  profileId: string,
  title: string,
  body: string,
  url: string = '/',
  options: NotificationSendOptions = {}
): Promise<NotificationSendResult> {
  const now = options.now ?? new Date()
  const admin = createAdminClient()
  const result: NotificationSendResult = {
    feedLogged: false,
    pushSuppressed: false,
    sentSubscriptions: 0,
    removedSubscriptions: 0,
    failedSubscriptions: 0,
  }

  const { data: preferences, error: preferencesError } = await admin
    .from('profiles')
    .select(
      'push_enabled, in_app_feed_enabled, night_suppression_enabled, suppression_start, suppression_end, timezone'
    )
    .eq('id', profileId)
    .maybeSingle()

  if (preferencesError) {
    console.error('Failed to load notification preferences:', preferencesError)
    return result
  }

  if (!preferences) return result

  const profilePreferences = preferences as NotificationPreferences
  if (options.includeFeed !== false && profilePreferences.in_app_feed_enabled) {
    const { error: logError } = await admin.from('notification_logs').insert({
      profile_id: profileId,
      title,
      body,
    })

    if (logError) {
      console.error('Failed to write notification feed entry:', logError)
    } else {
      result.feedLogged = true
    }
  }

  const currentLocalTime = localTime(now, profilePreferences.timezone)
  result.pushSuppressed =
    profilePreferences.night_suppression_enabled &&
    isWithinSuppressionWindow(
      currentLocalTime.hour,
      currentLocalTime.minute,
      profilePreferences.suppression_start,
      profilePreferences.suppression_end
    )

  if (
    options.includePush === false ||
    !profilePreferences.push_enabled ||
    result.pushSuppressed ||
    !isWebPushConfigured()
  ) {
    return result
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('profile_id', profileId)

  if (subscriptionsError) {
    console.error('Failed to load push subscriptions:', subscriptionsError)
    return result
  }

  const payload = JSON.stringify({ title, body, url })
  const sendResults = await Promise.allSettled(
    ((subscriptions ?? []) as PushSubscription[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        )
        return 'sent' as const
      } catch (error) {
        if (isExpiredPushSubscriptionError(error)) {
          const { error: deleteError } = await admin
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint)

          if (deleteError) {
            console.error('Failed to remove expired push subscription:', deleteError)
            return 'failed' as const
          }

          return 'removed' as const
        }

        console.error('Failed to send push notification:', error)
        return 'failed' as const
      }
    })
  )

  for (const sendResult of sendResults) {
    if (sendResult.status === 'rejected' || sendResult.value === 'failed') {
      result.failedSubscriptions += 1
    } else if (sendResult.value === 'removed') {
      result.removedSubscriptions += 1
    } else {
      result.sentSubscriptions += 1
    }
  }

  return result
}
