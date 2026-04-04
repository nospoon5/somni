'use client'

import { useEffect, useState } from 'react'
import styles from './SupportForm.module.css'

type SupportCategory = 'bug' | 'feedback' | 'billing' | 'other'

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; id: string }
  | { status: 'error'; message: string }

const categoryOptions: Array<{ value: SupportCategory; label: string }> = [
  { value: 'bug', label: 'Bug' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
]

export function SupportForm() {
  const [category, setCategory] = useState<SupportCategory>('bug')
  const [message, setMessage] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [state, setState] = useState<SubmitState>({ status: 'idle' })

  useEffect(() => {
    setPageUrl(window.location.href)
  }, [])

  async function submit() {
    const trimmed = message.trim()
    if (trimmed.length < 10) {
      setState({
        status: 'error',
        message: 'Please add a little more detail (at least 10 characters).',
      })
      return
    }

    setState({ status: 'submitting' })

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          message: trimmed,
          pageUrl,
          userAgent: navigator.userAgent,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { id?: unknown; error?: unknown }
        | null

      if (!response.ok || typeof payload?.id !== 'string') {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Unable to send this right now.'
        )
      }

      setState({ status: 'success', id: payload.id })
      setMessage('')
    } catch (caughtError) {
      const messageText =
        caughtError instanceof Error ? caughtError.message : 'Unable to send this right now.'
      setState({ status: 'error', message: messageText })
    }
  }

  return (
    <section className={styles.shell} aria-label="Support request form">
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Type</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as SupportCategory)}
            disabled={state.status === 'submitting'}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Page</span>
          <input value={pageUrl} readOnly />
        </label>

        <label className={styles.fieldWide}>
          <span>What happened?</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            placeholder="Example: I ended a sleep session, but it still shows as running on the dashboard."
            disabled={state.status === 'submitting'}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={submit}
          disabled={state.status === 'submitting'}
        >
          {state.status === 'submitting' ? 'Sending...' : 'Send'}
        </button>
      </div>

      {state.status === 'success' ? (
        <p className={styles.success}>
          Thanks. Your support request ID is <strong>{state.id}</strong>.
        </p>
      ) : null}

      {state.status === 'error' ? <p className={styles.error}>{state.message}</p> : null}
    </section>
  )
}

