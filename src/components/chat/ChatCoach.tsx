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
}

type ParsedEvent = {
  event: string
  payload: unknown
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

export function ChatCoach({ babyName }: ChatCoachProps) {
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

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || isSending) {
      return
    }

    setError(null)
    setIsSending(true)
    setDraft('')

    const userMessageId = nowId('user')
    const assistantMessageId = nowId('assistant')

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

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null)
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
      const messageText =
        caughtError instanceof Error ? caughtError.message : 'Unable to send message.'
      setError(messageText)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className={styles.shell}>
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
