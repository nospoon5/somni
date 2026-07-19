'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SleepActionState } from '@/app/sleep/actions'
import { endSleepAction, startSleepAction, updateSleepLogAction } from '@/app/sleep/actions'
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

function toLocalDatetimeString(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function SleepTracker({ activeLog, recentLogs }: SleepTrackerProps) {
  const router = useRouter()
  const [startState, startFormAction, startPending] = useActionState(
    startSleepAction,
    initialState
  )
  const [endState, endFormAction, endPending] = useActionState(
    endSleepAction,
    initialState
  )

  const [editingLog, setEditingLog] = useState<RecentLog | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editPending, startEditTransition] = useTransition()
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)

  function openEditModal(log: RecentLog) {
    setEditingLog(log)
    setEditStart(toLocalDatetimeString(log.startedAt))
    setEditEnd(log.endedAt ? toLocalDatetimeString(log.endedAt) : '')
    setEditNotes(log.notes || '')
    setEditTags(log.tags)
    setEditError(null)
    setEditSuccess(null)
  }

  function handleTagToggle(tagValue: string) {
    setEditTags(prev =>
      prev.includes(tagValue)
        ? prev.filter(t => t !== tagValue)
        : [...prev, tagValue]
    )
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLog) return
    setEditError(null)
    setEditSuccess(null)

    const isoStart = new Date(editStart).toISOString()
    const isoEnd = editEnd ? new Date(editEnd).toISOString() : null

    startEditTransition(async () => {
      try {
        const res = await updateSleepLogAction(
          editingLog.id,
          isoStart,
          isoEnd,
          editTags,
          editNotes
        )
        if (res.error) {
          setEditError(res.error)
        } else {
          setEditSuccess('Changes saved successfully.')
          setTimeout(() => {
            setEditingLog(null)
            router.refresh()
          }, 1000)
        }
      } catch {
        setEditError('Something went wrong while saving changes.')
      }
    })
  }

  useEffect(() => {
    if (startState.success || endState.success) {
      router.refresh()
    }
  }, [endState.success, router, startState.success])

  return (
    <div className={styles.layout}>
      <section className={`${styles.card} card`}>
        <p className={`${styles.kicker} text-label`}>Sleep tracking</p>
        <h1 className={`${styles.title} text-display`}>
          {activeLog ? 'A sleep session is running.' : 'Ready to start a new sleep session?'}
        </h1>
        <p className={`${styles.subtitle} text-body`}>
          Keep this fast and low-effort. Start with one tap, then add a note or tag
          only if it helps.
        </p>

        {!activeLog ? (
          <form action={startFormAction} className={styles.singleAction}>
            <button className="btn-primary" type="submit" disabled={startPending}>
              {startPending ? 'Starting...' : 'Start sleep'}
            </button>
            {startState.error ? <p className={styles.error}>{startState.error}</p> : null}
            {startState.success ? (
              <p className={styles.success}>{startState.success}</p>
            ) : null}
          </form>
        ) : (
          <form action={endFormAction} className={`${styles.endForm} animate-pulse-ring`}>
            <input type="hidden" name="activeLogId" value={activeLog.id} />

            <p className={styles.activeLabel}>Currently sleeping</p>
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
              <button className="btn-primary" type="submit" disabled={endPending}>
                {endPending ? 'Saving...' : 'End sleep'}
              </button>
            </div>

            {endState.error ? <p className={styles.error}>{endState.error}</p> : null}
            {endState.success ? <p className={styles.success}>{endState.success}</p> : null}
          </form>
        )}
      </section>

      <section className={`${styles.historyCard} card`}>
        <div className={styles.historyHeader}>
          <div>
            <p className={`${styles.kicker} text-label`}>Recent history</p>
            <h2 className={`${styles.historyTitle} text-display`}>Latest logged sleep</h2>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <p className={`${styles.emptyState} text-body`}>
            No sleep logs yet. Start one when your baby goes down and we&apos;ll build
            your history from there.
          </p>
        ) : (
          <ul className={styles.historyList}>
            {recentLogs.map((log) => (
              <li className={`${styles.historyItem} card`} key={log.id}>
                <div className={styles.historyRow}>
                  <div className={styles.historyMeta}>
                    <strong>{log.isNight ? 'Night sleep' : 'Day sleep'}</strong>
                    <span>{formatDateTime(log.startedAt)}</span>
                  </div>
                  <button
                    className={styles.correctButton}
                    onClick={() => openEditModal(log)}
                    aria-label={`Correct logs for ${log.isNight ? 'night' : 'day'} sleep`}
                  >
                    Correct
                  </button>
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
      {editingLog && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="edit-title">
          <div className={`${styles.modalCard} card animate-fade-up`}>
            <div className={styles.modalHeader}>
              <h3 id="edit-title" className={`${styles.modalTitle} text-display`}>Correct sleep log</h3>
              <button
                className={styles.closeButton}
                onClick={() => setEditingLog(null)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className={styles.modalForm}>
              {editError && <p className={styles.error}>{editError}</p>}
              {editSuccess && <p className={styles.success}>{editSuccess}</p>}

              <label className={styles.fieldLabel}>
                <span>Start Time</span>
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  required
                  className={styles.dateTimeInput}
                />
              </label>

              <label className={styles.fieldLabel}>
                <span>End Time</span>
                <input
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className={styles.dateTimeInput}
                />
              </label>

              <p className={styles.tagLabel}>Tags</p>
              <div className={styles.modalTagGrid}>
                {availableTags.map((tag) => (
                  <label className={styles.tagOption} key={`edit-tag-${tag.value}`}>
                    <input
                      type="checkbox"
                      value={tag.value}
                      checked={editTags.includes(tag.value)}
                      onChange={() => handleTagToggle(tag.value)}
                    />
                    <span>{tag.label}</span>
                  </label>
                ))}
              </div>

              <label className={styles.notesField}>
                <span>Notes</span>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes about how this sleep went"
                />
              </label>

              <div className={styles.modalActions}>
                <button type="submit" className="btn-primary" disabled={editPending}>
                  {editPending ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingLog(null)}
                  disabled={editPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
