'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import {
  DAILY_PLAN_STORAGE_KEY,
  type DailyPlanStreamPayload,
} from '@/lib/daily-plan'

type SourceAttribution = {
  name: string
  topic: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceAttribution[]
  safetyNote?: string | null
  confidence?: 'high' | 'medium' | 'low'
  isEmergencyRedirect?: boolean
}

export type LimitState = {
  message: string
  upgradeHint: string
  dailyLimit: number
  used: number
  resetAt: string
  timezone: string
}

export type PlanUpdateState = {
  message: string
  updatedAt: string | null
}

type ParsedEvent = {
  event: string
  payload: unknown
}

type UseChatSessionArgs = {
  babyName: string
  billingEnabled: boolean
  isReadOnly: boolean
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

export function useChatSession(args: UseChatSessionArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi, I'm Somni. Tell me what tonight looks like for ${args.babyName}, and I'll help with a calm, practical plan.`,
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
    if (!args.billingEnabled || billingAction) {
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
    if (args.isReadOnly) {
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
              : "You have reached today's free Somni chat limit.",
          upgradeHint:
            typeof payload?.upgradeHint === 'string'
              ? payload.upgradeHint
              : 'Somni Premium removes the daily chat cap.',
          dailyLimit: typeof payload?.dailyLimit === 'number' ? payload.dailyLimit : 10,
          used: typeof payload?.used === 'number' ? payload.used : 10,
          resetAt: typeof payload?.resetAt === 'string' ? payload.resetAt : new Date().toISOString(),
          timezone: typeof payload?.timezone === 'string' ? payload.timezone : 'Australia/Sydney',
        })
        return
      }

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null)
        setMessages((current) => current.filter((message) => message.id !== assistantMessageId))
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

                const finalMessage = typeof payload.message === 'string' ? payload.message : ''

                return {
                  ...message,
                  content:
                    payload.replace_message === true
                      ? finalMessage
                      : message.content || finalMessage,
                  sources: Array.isArray(payload.sources)
                    ? (payload.sources as SourceAttribution[])
                    : [],
                  safetyNote: typeof payload.safety_note === 'string' ? payload.safety_note : null,
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
              message: "Today's dashboard plan has been updated.",
              updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
            })

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: "Updating today's dashboard plan..." }
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
      setMessages((current) => current.filter((message) => message.id !== assistantMessageId))
      setDraft(trimmed)
      const messageText =
        caughtError instanceof Error ? caughtError.message : 'Unable to send message.'
      setError(messageText)
    } finally {
      setIsSending(false)
    }
  }

  return {
    messages,
    draft,
    setDraft,
    isSending,
    error,
    limitState,
    planUpdate,
    billingAction,
    openCheckout,
    submitMessage,
  }
}
