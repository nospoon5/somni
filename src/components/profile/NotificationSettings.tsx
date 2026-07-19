'use client'

import { useState, useTransition } from 'react'
import {
  updateNotificationPreferencesAction,
  type NotificationPreferencesInput,
} from '@/app/profile/actions'
import styles from './NotificationSettings.module.css'

type NotificationSettingsProps = {
  initialPreferences: NotificationPreferencesInput
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

export function NotificationSettings({ initialPreferences }: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState(initialPreferences)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(nextPreferences: NotificationPreferencesInput) {
    const previousPreferences = preferences
    setPreferences(nextPreferences)
    setMessage(null)
    startTransition(async () => {
      const result = await updateNotificationPreferencesAction(nextPreferences)
      if (result.error) {
        setMessage('Failed to update notification preferences: ' + result.error)
        setPreferences(previousPreferences)
      }
    })
  }

  async function setPushEnabled(enabled: boolean) {
    if (!enabled) {
      const registration = await navigator.serviceWorker?.ready.catch(() => null)
      const subscription = registration ? await registration.pushManager.getSubscription() : null
      if (subscription) {
        const response = await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => undefined)
        
        if (response && !response.ok) {
          setMessage('Failed to unsubscribe push alerts. Please try again.')
          return
        }
        
        await subscription.unsubscribe().catch(() => false)
      }
      save({ ...preferences, pushEnabled: false })
      return
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMessage('Push alerts are not supported by this browser. You can still use the in-app feed.')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setMessage('Browser permission is needed before Somni can send push alerts.')
      return
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      setMessage('Push alerts are not configured yet. Please try again later.')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }))
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      if (!response.ok) throw new Error('Subscription could not be saved')
      save({ ...preferences, pushEnabled: true })
    } catch {
      setMessage('We could not enable push alerts on this device. Please try again.')
    }
  }

  return (
    <section className={`${styles.section} card`}>
      <h2 className={`${styles.sectionTitle} text-display`}>Notifications</h2>
      <p className="text-body">Choose how Somni keeps you up to date when another caregiver logs sleep.</p>

      <label className={styles.setting}>
        <span><strong>Push alerts</strong><small>Send an alert to this browser when a caregiver logs a session.</small></span>
        <input
          type="checkbox"
          checked={preferences.pushEnabled}
          onChange={(event) => void setPushEnabled(event.target.checked)}
          disabled={pending}
        />
      </label>

      <label className={styles.setting}>
        <span><strong>In-app feed</strong><small>Keep recent caregiver updates in the dashboard notification bell.</small></span>
        <input
          type="checkbox"
          checked={preferences.inAppFeedEnabled}
          onChange={(event) => save({ ...preferences, inAppFeedEnabled: event.target.checked })}
          disabled={pending}
        />
      </label>

      <label className={styles.setting}>
        <span><strong>Quiet hours</strong><small>During these times, Somni records updates in your feed without sending a push alert.</small></span>
        <input
          type="checkbox"
          checked={preferences.nightSuppressionEnabled}
          onChange={(event) => save({ ...preferences, nightSuppressionEnabled: event.target.checked })}
          disabled={pending}
        />
      </label>

      <div className={styles.timeGrid} aria-disabled={!preferences.nightSuppressionEnabled}>
        <label>Start<input type="time" value={preferences.suppressionStart} onChange={(event) => save({ ...preferences, suppressionStart: event.target.value })} disabled={pending || !preferences.nightSuppressionEnabled} /></label>
        <label>End<input type="time" value={preferences.suppressionEnd} onChange={(event) => save({ ...preferences, suppressionEnd: event.target.value })} disabled={pending || !preferences.nightSuppressionEnabled} /></label>
      </div>

      {message ? <p className={styles.message} role="status">{message}</p> : null}
    </section>
  )
}
