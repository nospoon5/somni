'use client'

import { useState, useTransition } from 'react'
import { markAllNotificationsReadAction } from '@/app/dashboard/actions'
import { formatNotificationTime } from '@/lib/notifications/feed'
import styles from './NotificationBell.module.css'

export type DashboardNotification = {
  id: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

type NotificationBellProps = {
  initialNotifications: DashboardNotification[]
  initialUnreadCount: number
}

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function markAllRead() {
    setError(null)
    startTransition(async () => {
      const result = await markAllNotificationsReadAction()
      if (result.error) {
        setError(result.error)
        return
      }
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })))
      setUnreadCount(0)
    })
  }

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.bell}
        type="button"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {unreadCount ? <span className={styles.count}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>

      {open ? (
        <section className={styles.feed} aria-label="Recent notifications">
          <div className={styles.feedHeader}>
            <div><p className="text-label">Notifications</p><strong>Recent updates</strong></div>
            {unreadCount ? <button type="button" onClick={markAllRead} disabled={pending}>Mark all as read</button> : null}
          </div>
          {error ? <p className={styles.error} role="status">{error}</p> : null}
          {notifications.length ? (
            <ul className={styles.list}>
              {notifications.map((notification) => (
                <li className={!notification.isRead ? styles.unread : undefined} key={notification.id}>
                  <strong>{notification.title}</strong><span>{notification.body}</span><time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>Caregiver updates will appear here.</p>}
        </section>
      ) : null}
    </div>
  )
}
