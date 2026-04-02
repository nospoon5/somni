'use client'

import { useActionState } from 'react'
import type { SleepActionState } from '@/app/sleep/actions'
import { endSleepAction, startSleepAction } from '@/app/sleep/actions'
import styles from './SleepTracker.module.css'

type ActiveLog = {
  id: string
  startedAt: string
}

type RecentLog = {
  id: string
  startedAt: string
  endedAt: string | null
  isNight: boolean
  tags: string[]
  notes: string | null
}

type SleepTrackerProps = {
  activeLog: ActiveLog | null
  recentLogs: RecentLog[]
}

const initialState: SleepActionState = {}

const availableTags = [
  { value: 'easy_settle', label: 'Easy settle' },
  { value: 'hard_settle', label: 'Hard settle' },
  { value: 'short_nap', label: 'Short nap' },
  { value: 'false_start', label: 'False start' },
  { value: 'self_settled', label: 'Self-settled' },
  { value: 'needed_help', label: 'Needed help' },
]

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDuration(startedAt: string, endedAt: string | null) {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const start = new Date(startedAt).getTime()
  const totalMinutes = Math.max(1, Math.round((end - start) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} hr`
  }

  return `${hours} hr ${minutes} min`
}

export function SleepTracker({ activeLog, recentLogs }: SleepTrackerProps) {
  const [startState, startFormAction, startPending] = useActionState(
    startSleepAction,
    initialState
  )
  const [endState, endFormAction, endPending] = useActionState(
    endSleepAction,
    initialState
  )

  return (
    <div className={styles.layout}>
      <section className={styles.card}>
        <p className={styles.kicker}>Sleep tracking</p>
        <h1 className={styles.title}>
          {activeLog ? 'A sleep session is running.' : 'Ready to start a new sleep session?'}
        </h1>
        <p className={styles.subtitle}>
          Keep this fast and low-effort. Start with one tap, then add a note or tag
          only if it helps.
        </p>

        {!activeLog ? (
          <form action={startFormAction} className={styles.singleAction}>
            <button className={styles.primaryButton} type="submit" disabled={startPending}>
              {startPending ? 'Starting...' : 'Start sleep'}
            </button>
            {startState.error ? <p className={styles.error}>{startState.error}</p> : null}
            {startState.success ? (
              <p className={styles.success}>{startState.success}</p>
            ) : null}
          </form>
        ) : (
          <form action={endFormAction} className={styles.endForm}>
            <input type="hidden" name="activeLogId" value={activeLog.id} />

            <div className={styles.activeSummary}>
              <span>Started {formatDateTime(activeLog.startedAt)}</span>
              <strong>{formatDuration(activeLog.startedAt, null)} so far</strong>
            </div>

            <div className={styles.tagGrid}>
              {availableTags.map((tag) => (
                <label className={styles.tagOption} key={tag.value}>
                  <input name="tags" type="checkbox" value={tag.value} />
                  <span>{tag.label}</span>
                </label>
              ))}
            </div>

            <label className={styles.notesField}>
              <span>Notes</span>
              <textarea
                name="notes"
                rows={4}
                placeholder="Optional notes about how this sleep went"
              />
            </label>

            <div className={styles.singleAction}>
              <button className={styles.primaryButton} type="submit" disabled={endPending}>
                {endPending ? 'Saving...' : 'End sleep'}
              </button>
            </div>

            {endState.error ? <p className={styles.error}>{endState.error}</p> : null}
            {endState.success ? <p className={styles.success}>{endState.success}</p> : null}
          </form>
        )}
      </section>

      <section className={styles.historyCard}>
        <div className={styles.historyHeader}>
          <div>
            <p className={styles.kicker}>Recent history</p>
            <h2 className={styles.historyTitle}>Latest logged sleep</h2>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <p className={styles.emptyState}>
            No sleep logs yet. Start one when your baby goes down and we&apos;ll build
            your history from there.
          </p>
        ) : (
          <ul className={styles.historyList}>
            {recentLogs.map((log) => (
              <li className={styles.historyItem} key={log.id}>
                <div className={styles.historyMeta}>
                  <strong>{log.isNight ? 'Night sleep' : 'Day sleep'}</strong>
                  <span>{formatDateTime(log.startedAt)}</span>
                </div>
                <div className={styles.historyDuration}>
                  {formatDuration(log.startedAt, log.endedAt)}
                </div>
                {log.tags.length > 0 ? (
                  <div className={styles.logTags}>
                    {log.tags.map((tag) => (
                      <span key={tag}>{tag.replaceAll('_', ' ')}</span>
                    ))}
                  </div>
                ) : null}
                {log.notes ? <p className={styles.logNotes}>{log.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
