'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import {
  DAILY_PLAN_STORAGE_KEY,
  type DailyPlanStreamPayload,
} from '@/lib/daily-plan'
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
  pageEyebrow: string
  pageTitle: string
  pageSubtitle: string
  billingEnabled: boolean
  hasPremiumAccess: boolean
  isReadOnly?: boolean
  billingDegradedReason?: string | null
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

type PlanUpdateState = {
  message: string
  updatedAt: string | null
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

function formatText(text: string) {
  if (!text) return text;
  const parts = text.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index}>{part}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function ChatCoach({
  babyName,
  pageEyebrow,
  pageTitle,
  pageSubtitle,
  billingEnabled,
  hasPremiumAccess,
  isReadOnly = false,
  billingDegradedReason = null,
}: ChatCoachProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi, I'm Somni. Tell me what tonight looks like for ${babyName}, and I'll help with a calm, practical plan.`,
    },
  ])
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitState, setLimitState] = useState<LimitState | null>(null)
  const [planUpdate, setPlanUpdate] = useState<PlanUpdateState | null>(null)
  const [billingAction, setBillingAction] = useState<'monthly' | 'annual' | null>(null)

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

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isReadOnly) {
      return
    }

    const trimmed = draft.trim()
    if (!trimmed || isSending) {
      return
    }

    setError(null)
    setLimitState(null)
    setPlanUpdate(null)
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
              : 'You have reached today\'s free Somni chat limit.',
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
              replace_message?: unknown
            }

            if (typeof payload.conversation_id === 'string') {
              setConversationId(payload.conversation_id)
            }

            setMessages((current) =>
              current.map((message) => {
                if (message.id !== assistantMessageId) {
                  return message
                }

                const finalMessage =
                  typeof payload.message === 'string' ? payload.message : ''

                return {
                  ...message,
                  content:
                    payload.replace_message === true
                      ? finalMessage
                      : message.content || finalMessage,
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

          if (parsed.event === 'plan_updated') {
            const payload = parsed.payload as DailyPlanStreamPayload

            setPlanUpdate({
              message: 'Today\'s dashboard plan has been updated.',
              updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
            })

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: 'Updating today\'s dashboard plan...' }
                  : message
              )
            )

            if (typeof window !== 'undefined') {
              try {
                window.localStorage.setItem(DAILY_PLAN_STORAGE_KEY, JSON.stringify(payload))
              } catch {
                // Ignore browser storage failures and continue chat flow.
              }
            }
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
      <section className={`${styles.headerCard} card`}>
        <p className={`${styles.headerEyebrow} text-label`}>{pageEyebrow}</p>
        <h1 className={`${styles.headerTitle} text-display`}>{pageTitle}</h1>
        <p className={`${styles.headerSubtitle} text-body`}>{pageSubtitle}</p>
        <p className={`${styles.headerQuota} text-body`}>
          {hasPremiumAccess ? 'Premium access active' : 'Free plan · 10 chats per day'}
        </p>
        <Link href="/dashboard" className={`${styles.backLink} text-body`}>
          &larr; Back to Dashboard
        </Link>
      </section>

      {billingDegradedReason ? (
        <section className={`${styles.systemNotice} card`}>
          <p className={`${styles.systemNoticeLabel} text-label`}>System notice</p>
          <p className={styles.systemNoticeBody}>{billingDegradedReason}</p>
        </section>
      ) : null}

      {limitState ? (
        <section className={`${styles.limitCard} card`}>
          <p className={`${styles.limitLabel} text-label`}>Daily limit reached</p>
          <h2 className={`${styles.limitTitle} text-display`}>You have used today&apos;s free chats.</h2>
          <p className={styles.limitBody}>{limitState.message}</p>
          <p className={styles.limitMeta}>
            Used {limitState.used} of {limitState.dailyLimit}. Resets{' '}
            {formatResetTime(limitState.resetAt, limitState.timezone)} ({limitState.timezone}).
          </p>
          <p className={styles.limitHint}>{limitState.upgradeHint}</p>

          <div className={styles.limitActions}>
            <button
              className="btn-primary"
              type="button"
              onClick={() => openCheckout('monthly')}
              disabled={!billingEnabled || billingAction !== null || isReadOnly}
            >
              {billingAction === 'monthly' ? 'Opening...' : 'Upgrade monthly'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => openCheckout('annual')}
              disabled={!billingEnabled || billingAction !== null || isReadOnly}
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

      {planUpdate ? (
        <section className={`${styles.systemNotice} card`}>
          <p className={`${styles.systemNoticeLabel} text-label`}>Dashboard updated</p>
          <p className={styles.systemNoticeBody}>
            {planUpdate.message}
            {planUpdate.updatedAt ? ` Saved at ${new Date(planUpdate.updatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}.` : ''}
          </p>
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
            <p className={`${styles.roleLabel} text-label`}>
              {message.role === 'assistant' ? 'Somni' : 'You'}
            </p>
            <p className={styles.messageText}>
              {message.content
                ? formatText(message.content)
                : (message.role === 'assistant' && isSending
                    ? <span className={styles.loadingDots}><span>.</span><span>.</span><span>.</span></span>
                    : '')}
            </p>

            {message.safetyNote ? (
              <p className={styles.safetyNote}>{message.safetyNote}</p>
            ) : null}

            {message.sources && message.sources.length > 0 ? (
              <div className={styles.sources}>
                {Array.from(new Set(message.sources.map((s) => s.name)))
                  .slice(0, 2)
                  .map((name) => (
                    <span className={styles.sourceChip} key={name}>
                      {name}
                    </span>
                  ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <form className={styles.form} onSubmit={submitMessage}>
        <label className={`${styles.label} text-label`} htmlFor="chat-message">
          {isReadOnly ? 'Chat temporarily read-only' : 'Ask Somni'}
        </label>
        <div className={styles.inputRow}>
          <textarea
            id="chat-message"
            className={styles.textarea}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              isReadOnly
                ? 'Chat is temporarily unavailable while billing reconnects.'
                : 'Example: We had three night wakes and short naps today. What should I try tonight?'
            }
            rows={3}
            disabled={isSending || isReadOnly}
            required
          />
          <button
            className={styles.sendButton}
            type="submit"
            disabled={isSending || !draft.trim() || isReadOnly}
            aria-label={isSending ? 'Sending message' : 'Send message'}
          >
            {isSending ? '...' : '>'}
          </button>
        </div>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  )
}
