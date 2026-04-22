'use client'

import { useEffect, useState } from 'react'
import {
  DAILY_PLAN_STORAGE_KEY,
  formatDailyPlanTime,
  type DailyPlanFeedTarget,
  type DailyPlanRecord,
  type DailyPlanSleepTarget,
  type DailyPlanStreamPayload,
} from '@/lib/daily-plan'
import styles from './DailyPlanPanel.module.css'

type DailyPlanPanelProps = {
  babyName: string
  initialPlan: DailyPlanRecord | null
  todayPlanDate: string
}

function isEphemeralPlan(plan: DailyPlanRecord | null) {
  if (!plan) {
    return true
  }

  const origin = plan.metadata?.origin
  if (origin && origin !== 'saved_daily_plan') {
    return true
  }

  return (
    plan.id.startsWith('baseline-') ||
    plan.id.startsWith('derived-') ||
    plan.id.startsWith('live-')
  )
}

function hydratePlanFromPayload(
  currentPlan: DailyPlanRecord | null,
  payload: DailyPlanStreamPayload
): DailyPlanRecord {
  const preservedPlan = currentPlan && !isEphemeralPlan(currentPlan) ? currentPlan : null

  return {
    id: preservedPlan?.id ?? `live-${payload.planDate}`,
    babyId: preservedPlan?.babyId ?? 'live',
    planDate: payload.planDate,
    sleepTargets: payload.sleepTargets,
    feedTargets: payload.feedTargets,
    notes: payload.notes,
    updatedAt: payload.updatedAt,
    metadata:
      payload.metadata ?? {
        origin: 'live_stream',
        confidence: null,
        reasonSummary: null,
      },
  }
}

function shouldApplyPayload(
  currentPlan: DailyPlanRecord | null,
  payload: DailyPlanStreamPayload
) {
  if (!currentPlan?.updatedAt || !payload.updatedAt) {
    return true
  }

  return new Date(payload.updatedAt).getTime() >= new Date(currentPlan.updatedAt).getTime()
}

function isPlanPayload(value: unknown): value is DailyPlanStreamPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const payload = value as Partial<DailyPlanStreamPayload>
  return (
    typeof payload.planDate === 'string' &&
    Array.isArray(payload.sleepTargets) &&
    Array.isArray(payload.feedTargets)
  )
}

function renderTimeBlock(time: string | null, detail?: string | null) {
  const formattedTime = formatDailyPlanTime(time)

  if (!formattedTime && !detail) {
    return 'Time to be confirmed'
  }

  if (formattedTime && detail) {
    return `${formattedTime} | ${detail}`
  }

  return formattedTime ?? detail ?? 'Time to be confirmed'
}

function formatRelativeTime(updatedAt: string): string {
  const updatedDate = new Date(updatedAt)

  if (Number.isNaN(updatedDate.getTime())) {
    return 'just now'
  }

  const now = new Date()
  const diffMs = Math.max(0, now.getTime() - updatedDate.getTime())
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 2) {
    return 'just now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`
  }

  const isSameDay =
    now.getFullYear() === updatedDate.getFullYear() &&
    now.getMonth() === updatedDate.getMonth() &&
    now.getDate() === updatedDate.getDate()

  if (isSameDay) {
    const time = updatedDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return `today at ${time}`
  }

  return updatedDate.toLocaleDateString()
}

function TargetList<T extends DailyPlanSleepTarget | DailyPlanFeedTarget>({
  targets,
  kind,
}: {
  targets: T[]
  kind: 'sleep' | 'feed'
}) {
  if (targets.length === 0) {
    return (
      <p className={styles.sectionHint}>
        {kind === 'sleep'
          ? 'No sleep targets saved yet for today.'
          : 'No feed targets saved yet for today.'}
      </p>
    )
  }

  return (
    <ul className={styles.targetList}>
      {targets.map((target) => (
        <li className={styles.targetItem} key={`${kind}-${target.label.toLowerCase()}`}>
          <div>
            <p className={styles.targetLabel}>{target.label}</p>
            <p className={styles.targetMeta}>
              {renderTimeBlock(
                target.targetTime,
                'window' in target ? target.window : null
              )}
            </p>
          </div>
          {target.notes ? <p className={styles.targetNotes}>{target.notes}</p> : null}
        </li>
      ))}
    </ul>
  )
}

export function DailyPlanPanel({ babyName, initialPlan, todayPlanDate }: DailyPlanPanelProps) {
  const [plan, setPlan] = useState(initialPlan)

  useEffect(() => {
    function applyPayload(rawValue: string | null) {
      if (!rawValue) {
        return
      }

      try {
        const parsed = JSON.parse(rawValue) as unknown
        if (!isPlanPayload(parsed)) {
          return
        }

        if (parsed.planDate !== todayPlanDate) {
          return
        }

        setPlan((currentPlan) =>
          shouldApplyPayload(currentPlan, parsed)
            ? hydratePlanFromPayload(currentPlan, parsed)
            : currentPlan
        )
      } catch {
        // Ignore invalid browser storage payloads.
      }
    }

    applyPayload(window.localStorage.getItem(DAILY_PLAN_STORAGE_KEY))

    function handleStorage(event: StorageEvent) {
      if (event.key !== DAILY_PLAN_STORAGE_KEY) {
        return
      }

      applyPayload(event.newValue)
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [todayPlanDate])

  return (
    <section className={`${styles.shell} card card-glass animate-fade-up`}>
      <div className={styles.header}>
        <div>
          <p className={`${styles.kicker} text-label`}>Today&apos;s plan</p>
          <h2 className={`${styles.title} text-display`}>
            {plan ? 'Live targets for today' : 'No live plan yet'}
          </h2>
        </div>
      </div>

      {plan ? (
        <>
          {plan.updatedAt ? (
            <p className={styles.lastUpdated}>Updated {formatRelativeTime(plan.updatedAt)}</p>
          ) : null}

          <p className={styles.body}>
            This is the shared plan Somni is keeping in sync for {babyName} today.
          </p>

          <div className={styles.sectionGrid}>
            <section className={styles.section}>
              <p className={`${styles.sectionLabel} text-label`}>Sleep targets</p>
              <TargetList kind="sleep" targets={plan.sleepTargets} />
            </section>

            <section className={styles.section}>
              <p className={`${styles.sectionLabel} text-label`}>Feed targets</p>
              <TargetList kind="feed" targets={plan.feedTargets} />
            </section>
          </div>

          {plan.notes ? (
            <section className={styles.notesBlock}>
              <p className={`${styles.sectionLabel} text-label`}>Coach note</p>
              <p className={styles.notesText}>{plan.notes}</p>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <p className={styles.body}>
            Here&apos;s Somni&apos;s customised baseline plan to help {babyName} start sleeping
            better. Somni will adjust it as we learn more and as your baby grows and
            develops.
          </p>

          <div className={styles.emptySteps}>
            <div className={styles.emptyStep}>
              <strong>1. Talk naturally in chat</strong>
              <span>Example: &quot;Let&apos;s push her afternoon nap to 3pm.&quot;</span>
            </div>
            <div className={styles.emptyStep}>
              <strong>2. Somni saves today&apos;s target</strong>
              <span>The dashboard updates with the latest plan for the rest of the day.</span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
