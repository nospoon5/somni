'use client'

import { FormEvent, useState } from 'react'
import styles from './ChatCoach.module.css'

type SourceAttribution = {
  name: string
  topic: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceAttribution[]
  safetyNote?: string | null
  confidence?: 'high' | 'medium' | 'low'
  isEmergencyRedirect?: boolean
}

type ChatCoachProps = {
  babyName: string
  billingEnabled: boolean
  subscriptionPlan: 'free' | 'monthly' | 'annual'
  subscriptionStatus: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled'
  hasPremiumAccess: boolean
}

type ParsedEvent = {
  event: string
  payload: unknown
}

type LimitState = {
  message: string
  upgradeHint: string
  dailyLimit: number
  used: number
  resetAt: string
  timezone: string
}

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseEventBlock(block: string): ParsedEvent | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return null
  }

  const eventLine = lines.find((line) => line.startsWith('event:'))
  const dataLine = lines.find((line) => line.startsWith('data:'))
  if (!eventLine || !dataLine) {
    return null
  }

  const event = eventLine.slice('event:'.length).trim()
  const rawData = dataLine.slice('data:'.length).trim()

  try {
    return { event, payload: JSON.parse(rawData) as unknown }
  } catch {
    return null
  }
}

function formatResetTime(resetAt: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(resetAt))
  } catch {
    return 'midnight'
  }
}

export function ChatCoach({
  babyName,
  billingEnabled,
  subscriptionPlan,
  subscriptionStatus,
  hasPremiumAccess,
}: ChatCoachProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi, I’m Somni. Tell me what tonight looks like for ${babyName}, and I’ll help with a calm, practical plan.`,
    },
  ])
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitState, setLimitState] = useState<LimitState | null>(null)
  const [billingAction, setBillingAction] = useState<'monthly' | 'annual' | 'portal' | null>(null)

  async function openCheckout(plan: 'monthly' | 'annual') {
    if (!billingEnabled || billingAction) {
      return
    }

    setError(null)
    setBillingAction(plan)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || typeof payload?.url !== 'string') {
        throw new Error(payload?.error ?? 'Unable to start checkout right now.')
      }

      window.location.assign(payload.url)
    } catch (caughtError) {
      const messageText =
        caughtError instanceof Error ? caughtError.message : 'Unable to start checkout right now.'
      setError(messageText)
    } finally {
      setBillingAction(null)
    }
  }

  async function openPortal() {
    if (!billingEnabled || billingAction) {
      return
    }

    setError(null)
    setBillingAction('portal')

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || typeof payload?.url !== 'string') {
        throw new Error(payload?.error ?? 'Unable to open billing settings right now.')
      }

      window.location.assign(payload.url)
    } catch (caughtError) {
      const messageText =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to open billing settings right now.'
      setError(messageText)
    } finally {
      setBillingAction(null)
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || isSending) {
      return
    }

    setError(null)
    setLimitState(null)
    setIsSending(true)
    setDraft('')

    const userMessageId = nowId('user')
    const assistantMessageId = nowId('assistant')
    const resetPendingMessages = () =>
      setMessages((current) =>
        current.filter(
          (message) => message.id !== userMessageId && message.id !== assistantMessageId
        )
      )

    setMessages((current) => [
      ...current,
      { id: userMessageId, role: 'user', content: trimmed },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          conversationId,
        }),
      })

      if (response.status === 429) {
        const payload = await response.json().catch(() => null)
        resetPendingMessages()
        setDraft(trimmed)
        setLimitState({
          message:
            typeof payload?.message === 'string'
              ? payload.message
              : 'You have reached today’s free Somni chat limit.',
          upgradeHint:
            typeof payload?.upgradeHint === 'string'
              ? payload.upgradeHint
              : 'Somni Premium removes the daily chat cap.',
          dailyLimit: typeof payload?.dailyLimit === 'number' ? payload.dailyLimit : 10,
          used: typeof payload?.used === 'number' ? payload.used : 10,
          resetAt:
            typeof payload?.resetAt === 'string' ? payload.resetAt : new Date().toISOString(),
          timezone:
            typeof payload?.timezone === 'string' ? payload.timezone : 'Australia/Sydney',
        })
        return
      }

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null)
        setMessages((current) =>
          current.filter((message) => message.id !== assistantMessageId)
        )
        setDraft(trimmed)
        throw new Error(payload?.error ?? `Chat request failed (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''

        for (const block of blocks) {
          const parsed = parseEventBlock(block)
          if (!parsed) {
            continue
          }

          if (parsed.event === 'token') {
            const token = (parsed.payload as { text?: unknown })?.text
            if (typeof token !== 'string') {
              continue
            }

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${token}` }
                  : message
              )
            )
          }

          if (parsed.event === 'done') {
            const payload = parsed.payload as {
              message?: unknown
              sources?: unknown
              safety_note?: unknown
              confidence?: unknown
              is_emergency_redirect?: unknown
              conversation_id?: unknown
            }

            if (typeof payload.conversation_id === 'string') {
              setConversationId(payload.conversation_id)
            }

            setMessages((current) =>
              current.map((message) => {
                if (message.id !== assistantMessageId) {
                  return message
                }

                return {
                  ...message,
                  content:
                    message.content ||
                    (typeof payload.message === 'string' ? payload.message : ''),
                  sources: Array.isArray(payload.sources)
                    ? (payload.sources as SourceAttribution[])
                    : [],
                  safetyNote:
                    typeof payload.safety_note === 'string' ? payload.safety_note : null,
                  confidence:
                    payload.confidence === 'high' ||
                    payload.confidence === 'medium' ||
                    payload.confidence === 'low'
                      ? payload.confidence
                      : undefined,
                  isEmergencyRedirect: Boolean(payload.is_emergency_redirect),
                }
              })
            )
          }

          if (parsed.event === 'error') {
            const payload = parsed.payload as { error?: unknown }
            const errorMessage =
              typeof payload.error === 'string'
                ? payload.error
                : 'Something went wrong while generating advice.'
            setError(errorMessage)
          }
        }
      }
    } catch (caughtError) {
      setMessages((current) =>
        current.filter((message) => message.id !== assistantMessageId)
      )
      setDraft(trimmed)
      const messageText =
        caughtError instanceof Error ? caughtError.message : 'Unable to send message.'
      setError(messageText)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className={styles.shell}>
      <section className={styles.planCard}>
        <div>
          <p className={styles.planLabel}>Plan</p>
          <p className={styles.planValue}>
            {hasPremiumAccess
              ? `Somni Premium (${subscriptionPlan})`
              : 'Somni Free'}
          </p>
          <p className={styles.planBody}>
            {hasPremiumAccess
              ? 'Premium access is active, so your coaching chat is not capped.'
              : 'Free access includes 10 coaching chats per day, resetting at midnight in your timezone.'}
          </p>
        </div>

        {hasPremiumAccess ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={openPortal}
            disabled={!billingEnabled || billingAction !== null}
          >
            {billingAction === 'portal' ? 'Opening...' : 'Manage billing'}
          </button>
        ) : (
          <p className={styles.planMeta}>Status: {subscriptionStatus}</p>
        )}
      </section>

      {limitState ? (
        <section className={styles.limitCard}>
          <p className={styles.limitLabel}>Daily limit reached</p>
          <h2 className={styles.limitTitle}>You’ve used today’s free chats.</h2>
          <p className={styles.limitBody}>{limitState.message}</p>
          <p className={styles.limitMeta}>
            Used {limitState.used} of {limitState.dailyLimit}. Resets{' '}
            {formatResetTime(limitState.resetAt, limitState.timezone)} ({limitState.timezone}).
          </p>
          <p className={styles.limitHint}>{limitState.upgradeHint}</p>

          <div className={styles.limitActions}>
            <button
              className={styles.sendButton}
              type="button"
              onClick={() => openCheckout('monthly')}
              disabled={!billingEnabled || billingAction !== null}
            >
              {billingAction === 'monthly' ? 'Opening...' : 'Upgrade monthly'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => openCheckout('annual')}
              disabled={!billingEnabled || billingAction !== null}
            >
              {billingAction === 'annual' ? 'Opening...' : 'Upgrade annual'}
            </button>
          </div>

          {!billingEnabled ? (
            <p className={styles.limitMeta}>
              Billing buttons will start working once Stripe is connected in the app
              environment.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className={styles.thread} aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === 'assistant' ? styles.assistantBubble : styles.userBubble
            }
          >
            <p className={styles.roleLabel}>
              {message.role === 'assistant' ? 'Somni Coach' : 'You'}
            </p>
            <p className={styles.messageText}>
              {message.content || (message.role === 'assistant' && isSending ? 'Thinking...' : '')}
            </p>

            {message.safetyNote ? (
              <p className={styles.safetyNote}>{message.safetyNote}</p>
            ) : null}

            {message.sources && message.sources.length > 0 ? (
              <p className={styles.sources}>
                Sources: {message.sources.map((source) => `${source.name} (${source.topic})`).join(', ')}
              </p>
            ) : null}

            {message.confidence ? (
              <p className={styles.confidence}>Confidence: {message.confidence}</p>
            ) : null}
          </article>
        ))}
      </div>

      <form className={styles.form} onSubmit={submitMessage}>
        <label className={styles.label} htmlFor="chat-message">
          Ask Somni
        </label>
        <textarea
          id="chat-message"
          className={styles.textarea}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Example: We had three night wakes and short naps today. What should I try tonight?"
          rows={3}
          disabled={isSending}
          required
        />
        <button className={styles.sendButton} type="submit" disabled={isSending || !draft.trim()}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  )
}
