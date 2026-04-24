'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { resolveSupportOrigin } from '@/lib/support/origin'
import styles from './SupportForm.module.css'

type SupportCategory = 'bug' | 'feedback' | 'billing' | 'other'

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; id: string }
  | { status: 'error'; message: string }

const categoryOptions: Array<{ value: SupportCategory; label: string }> = [
  { value: 'bug', label: "Something isn't working" },
  { value: 'feedback', label: 'Idea or feedback' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Something else' },
]

export function SupportForm() {
  const searchParams = useSearchParams()
  const [category, setCategory] = useState<SupportCategory>('bug')
  const [message, setMessage] = useState('')
  const [originPage, setOriginPage] = useState('')
  const [supportPage, setSupportPage] = useState('')
  const [state, setState] = useState<SubmitState>({ status: 'idle' })

  useEffect(() => {
    const currentSupportPage = `${window.location.pathname}${window.location.search}`
    const resolvedOrigin = resolveSupportOrigin({
      appOrigin: window.location.origin,
      currentSupportPage,
      queryOrigin: searchParams.get('from'),
      lastInAppPage: sessionStorage.getItem('somni:last-in-app-page'),
      documentReferrer: document.referrer,
    })

    setOriginPage(resolvedOrigin)
    setSupportPage(currentSupportPage)
  }, [searchParams])

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
          originPage,
          supportPage,
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
          <span>What do you need help with?</span>
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
          <span>Which screen were you on?</span>
          <input value={originPage} readOnly />
        </label>

        <label className={styles.fieldWide}>
          <span>What happened, and what were you hoping to see?</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            placeholder="Example: I ended a sleep, but the dashboard still showed it as running."
            disabled={state.status === 'submitting'}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button
          className="btn-primary"
          type="button"
          onClick={submit}
          disabled={state.status === 'submitting'}
        >
          {state.status === 'submitting' ? 'Sending...' : 'Send message'}
        </button>
      </div>

      {state.status === 'success' ? (
        <p className={styles.success}>
          Thanks, we&apos;ve got it. Your reference ID is <strong>{state.id}</strong>.
        </p>
      ) : null}

      {state.status === 'error' ? <p className={styles.error}>{state.message}</p> : null}
    </section>
  )
}
