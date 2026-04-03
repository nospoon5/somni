'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AppBottomNav.module.css'

function isActivePath(pathname: string, target: string) {
  if (pathname === target) return true
  // Future-proofing: treat nested routes as active (e.g. /sleep/history).
  return pathname.startsWith(`${target}/`)
}

function Icon({
  children,
}: {
  children: React.ReactNode
}) {
  return <span className={styles.icon} aria-hidden="true">{children}</span>
}

export function AppBottomNav() {
  const pathname = usePathname() ?? '/'

  // Only show on the core signed-in experience routes.
  const allowed = ['/dashboard', '/sleep', '/chat']
  if (!allowed.some((route) => isActivePath(pathname, route))) return null

  const dashboardActive = isActivePath(pathname, '/dashboard')
  const sleepActive = isActivePath(pathname, '/sleep')
  const chatActive = isActivePath(pathname, '/chat')

  return (
    <div className={styles.wrap} role="navigation" aria-label="Primary">
      <div className={styles.hint} aria-hidden="true" />
      <div className={styles.bar}>
        <Link
          className={`${styles.link} ${dashboardActive ? styles.active : ''}`}
          href="/dashboard"
          aria-current={dashboardActive ? 'page' : undefined}
        >
          <Icon>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M3.5 11.4 12 4.5l8.5 6.9v8.1c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8v-8.1Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9.2 20.9v-6.2c0-.7.6-1.3 1.3-1.3h3c.7 0 1.3.6 1.3 1.3v6.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </Icon>
          <span className={styles.label}>Dashboard</span>
        </Link>

        <Link
          className={`${styles.link} ${sleepActive ? styles.active : ''}`}
          href="/sleep"
          aria-current={sleepActive ? 'page' : undefined}
        >
          <Icon>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M20 15.2c-1.2 2.6-3.8 4.3-6.8 4.3-4.1 0-7.4-3.3-7.4-7.4 0-3 1.7-5.6 4.3-6.8.2-.1.5.1.4.4-1.3 3.6.6 7.6 4.2 9 1.7.7 3.7.7 5.4 0 .2-.1.5.2.4.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </Icon>
          <span className={styles.label}>Sleep</span>
        </Link>

        <Link
          className={`${styles.link} ${chatActive ? styles.active : ''}`}
          href="/chat"
          aria-current={chatActive ? 'page' : undefined}
        >
          <Icon>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M7 18.8 4.6 20.7c-.4.3-1-.1-.9-.6l.6-3.1c-1-1.2-1.6-2.6-1.6-4.2 0-4 4.1-7.2 9.3-7.2s9.3 3.2 9.3 7.2-4.1 7.2-9.3 7.2c-1.9 0-3.7-.4-5.2-1.2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M8.8 12.8h.01M12 12.8h.01M15.2 12.8h.01"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </Icon>
          <span className={styles.label}>Chat</span>
        </Link>
      </div>
    </div>
  )
}

