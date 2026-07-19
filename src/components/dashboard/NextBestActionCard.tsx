'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { NextBestActionRecommendation } from '@/lib/next-best-action/types'
import { formatClockTime } from '@/lib/date-utils'
import { acceptDailyRescueAction, dismissDailyRescueAction } from '@/app/sleep/actions'
import styles from './NextBestActionCard.module.css'

type NextBestActionCardProps = {
  recommendation: NextBestActionRecommendation | null
  babyId?: string
  planDate?: string
}

export function NextBestActionCard({ recommendation, babyId, planDate }: NextBestActionCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  if (!recommendation) {
    return null
  }

  const { state, actionTitle, targetTime, window, shortRationale, allowedActions } = recommendation

  const stateClass = styles[`state_${state}`] || ''

  async function handleAccept() {
    if (!babyId || !planDate) return
    setActionError(null)
    startTransition(async () => {
      try {
        const res = await acceptDailyRescueAction(babyId, planDate)
        if (res.error) {
          setActionError(res.error)
        } else {
          router.refresh()
        }
      } catch {
        setActionError('Failed to update schedule. Please try again.')
      }
    })
  }

  async function handleDismiss() {
    if (!babyId || !planDate) return
    setActionError(null)
    startTransition(async () => {
      try {
        const res = await dismissDailyRescueAction(babyId, planDate)
        if (res.error) {
          setActionError(res.error)
        } else {
          router.refresh()
        }
      } catch {
        setActionError('Failed to dismiss suggestion.')
      }
    })
  }

  return (
    <section className={`${styles.card} card animate-fade-up ${stateClass}`} aria-live="polite">
      <div className={styles.header}>
        <p className={`${styles.kicker} text-label`}>Next Best Action</p>
      </div>

      <div className={styles.content}>
        <h2 className={styles.actionTitle}>
          {actionTitle}
          {targetTime && (
            <span className={styles.timeEmphasis}>
              {' '}at {formatClockTime(targetTime)}
            </span>
          )}
        </h2>
        
        {window && (
          <p className={styles.window}>
            Around {window}
          </p>
        )}

        <p className={styles.rationale}>{shortRationale}</p>
        {actionError && <p className={styles.error}>{actionError}</p>}
      </div>

      <div className={styles.actions}>
        {allowedActions.includes('start_sleep') && (
          <Link href="/sleep" className={styles.primaryButton}>
            Log Sleep
          </Link>
        )}
        {allowedActions.includes('end_sleep') && (
          <Link href="/sleep" className={styles.primaryButton}>
            End Sleep
          </Link>
        )}
        {allowedActions.includes('log_missing_event') && (
          <Link href="/sleep" className={styles.primaryButton}>
            Log Event
          </Link>
        )}
        {allowedActions.includes('ask_somni') && (
          <Link href="/chat" className={styles.secondaryButton}>
            Ask Somni
          </Link>
        )}
        {allowedActions.includes('accept_rescue') && (
          <div className={styles.rescueActions}>
            <button
              className={styles.rescueButtonPrimary}
              onClick={handleAccept}
              disabled={isPending}
            >
              {isPending ? 'Updating...' : 'Update Schedule'}
            </button>
            <button
              className={styles.rescueButtonSecondary}
              onClick={handleDismiss}
              disabled={isPending}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
