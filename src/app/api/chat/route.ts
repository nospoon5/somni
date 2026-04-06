import { createClient } from '@/lib/supabase/server'
import { buildChatPrompt } from '@/lib/ai/prompt'
import { retrieveRelevantChunks, type SleepMethodology } from '@/lib/ai/retrieval'
import { checkEmergencyRisk, getEmergencyRedirectMessage } from '@/lib/ai/safety'
import { calculateSleepScore, getAgeBand } from '@/lib/scoring/sleep-score'
import {
  buildDailyLimitPayload,
  consumeChatQuota,
  releaseChatQuota,
  sanitizeTimezone,
} from '@/lib/billing/usage'
import {
  ensureSubscriptionRecord,
  hasPremiumAccess,
} from '@/lib/billing/subscriptions'

const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ChatRequestBody = {
  message?: unknown
  conversationId?: unknown
}

type SourceAttribution = {
  name: string
  topic: string
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function clampMessage(value: string) {
  return value.trim().slice(0, 4000)
}

function getConfidenceLabel(matchCount: number): 'high' | 'medium' | 'low' {
  if (matchCount >= 4) {
    return 'high'
  }

  if (matchCount >= 2) {
    return 'medium'
  }

  return 'low'
}

function getRecentSleepSummary(
  logs: Array<{
    started_at: string
    ended_at: string | null
    is_night: boolean
    tags: string[] | null
  }>
) {
  if (logs.length === 0) {
    return 'No recent sleep logs yet.'
  }

  const nightCount = logs.filter((log) => log.is_night).length
  const dayCount = logs.length - nightCount
  const activeCount = logs.filter((log) => !log.ended_at).length

  return `${logs.length} recent logs (${nightCount} night, ${dayCount} day, ${activeCount} active).`
}

function toSourceAttribution(
  chunks: Array<{
    topic: string
    sources: Array<{ name: string; url: string }>
  }>
): SourceAttribution[] {
  const seen = new Set<string>()
  const output: SourceAttribution[] = []

  for (const chunk of chunks) {
    for (const source of chunk.sources) {
      const key = `${source.name.toLowerCase()}::${chunk.topic.toLowerCase()}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      output.push({ name: source.name, topic: chunk.topic })
      if (output.length >= 5) {
        return output
      }
    }
  }

  return output
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return ''
  }

  const firstCandidate = candidates[0] as { content?: { parts?: Array<{ text?: string }> } }
  const parts = firstCandidate?.content?.parts
  if (!Array.isArray(parts)) {
    return ''
  }

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter((text) => text.length > 0)
    .join('')
}

async function streamGeminiResponse(prompt: string, onToken: (token: string) => void) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for chat')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 700,
          // This chat flow needs a complete parent-facing answer more than hidden
          // reasoning tokens. Gemini 2.5 Flash can spend output budget on thinking,
          // which was truncating replies mid-sentence in production.
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini stream failed (${response.status}): ${errorText}`)
  }

  if (!response.body) {
    throw new Error('Gemini stream did not return a response body')
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) {
        continue
      }

      const dataPayload = trimmed.slice(5).trim()
      if (!dataPayload || dataPayload === '[DONE]') {
        continue
      }

      try {
        const parsed = JSON.parse(dataPayload)
        const token = extractGeminiText(parsed)
        if (!token) {
          continue
        }

        fullText += token
        onToken(token)
      } catch {
        // Ignore malformed chunks and continue streaming the rest.
      }
    }
  }

  return fullText.trim()
}

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: Request) {
  let body: ChatRequestBody

  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawMessage = typeof body.message === 'string' ? body.message : ''
  const message = clampMessage(rawMessage)

  if (!message) {
    return Response.json({ error: 'Message is required' }, { status: 400 })
  }

  const requestedConversationId =
    typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
  const conversationId = isUuid(requestedConversationId)
    ? requestedConversationId
    : crypto.randomUUID()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, onboarding_completed, timezone')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile?.onboarding_completed) {
    return Response.json({ error: 'Onboarding incomplete' }, { status: 409 })
  }

  const { data: baby, error: babyError } = await supabase
    .from('babies')
    .select('id, name, date_of_birth, biggest_issue, feeding_type, bedtime_range')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (babyError) {
    return Response.json({ error: babyError.message }, { status: 500 })
  }

  if (!baby) {
    return Response.json({ error: 'Baby profile missing' }, { status: 404 })
  }

  const timezone = sanitizeTimezone(profile.timezone)
  const subscription = await ensureSubscriptionRecord({
    profileId: user.id,
    email: profile.email ?? user.email ?? null,
  })

  let quotaConsumed = false
  if (!hasPremiumAccess(subscription)) {
    const quota = await consumeChatQuota(user.id, timezone)
    if (!quota.allowed) {
      return Response.json(buildDailyLimitPayload(quota), { status: 429 })
    }
    quotaConsumed = true
  }

  const { data: preferences } = await supabase
    .from('onboarding_preferences')
    .select('sleep_style_label')
    .eq('baby_id', baby.id)
    .maybeSingle()

  const { data: recentSleepLogs } = await supabase
    .from('sleep_logs')
    .select('started_at, ended_at, is_night, tags')
    .eq('baby_id', baby.id)
    .order('started_at', { ascending: false })
    .limit(7)

  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('profile_id', user.id)
    .eq('baby_id', baby.id)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(8)

  const userInsert = await supabase.from('messages').insert({
    profile_id: user.id,
    baby_id: baby.id,
    conversation_id: conversationId,
    role: 'user',
    content: message,
  })

  if (userInsert.error) {
    if (quotaConsumed) {
      await releaseChatQuota(user.id, timezone).catch(() => {})
    }
    return Response.json({ error: userInsert.error.message }, { status: 500 })
  }

  const safety = checkEmergencyRisk(message)
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        let assistantPersisted = false

        try {
          if (safety.isEmergency) {
            const assistantMessage = getEmergencyRedirectMessage()
            const sources: SourceAttribution[] = []

            await supabase.from('messages').insert({
              profile_id: user.id,
              baby_id: baby.id,
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantMessage,
              sources_used: sources,
              safety_note: safety.safetyNote,
              is_emergency_redirect: true,
              confidence: 'high',
              model: 'safety-guardrail',
            })
            assistantPersisted = true

            controller.enqueue(
              encoder.encode(
                createSseEvent('done', {
                  message: assistantMessage,
                  sources,
                  safety_note: safety.safetyNote,
                  is_emergency_redirect: true,
                  confidence: 'high',
                  conversation_id: conversationId,
                })
              )
            )
            controller.close()
            return
          }

          const ageBand = getAgeBand(baby.date_of_birth)
          const retrievedChunks = await retrieveRelevantChunks({
            query: message,
            ageBand,
            methodology: (preferences?.sleep_style_label as SleepMethodology | null) ?? 'all',
            limit: 5,
          })

          const sources = toSourceAttribution(retrievedChunks)
          const confidence = getConfidenceLabel(retrievedChunks.length)
          const sleepLogs = recentSleepLogs ?? []
          const recentSleepSummary = getRecentSleepSummary(sleepLogs)
          const sleepScore = calculateSleepScore(
            baby.date_of_birth,
            sleepLogs.map((log) => ({
              startedAt: log.started_at,
              endedAt: log.ended_at,
              isNight: log.is_night,
              tags: log.tags ?? [],
            }))
          )
          const scoreSummary = sleepScore.hasData
            ? `${sleepScore.totalScore}/100 (${sleepScore.statusLabel}). Focus: ${sleepScore.tonightFocus}`
            : 'No score data yet.'

          const prompt = buildChatPrompt({
            babyName: baby.name,
            ageBand,
            sleepStyleLabel:
              (preferences?.sleep_style_label as SleepMethodology | null) ?? 'all',
            biggestIssue: baby.biggest_issue,
            feedingType: baby.feeding_type,
            bedtimeRange: baby.bedtime_range,
            recentSleepSummary,
            scoreSummary,
            conversationHistory: (recentMessages ?? [])
              .filter((item) => item.role === 'user' || item.role === 'assistant')
              .map((item) => ({
                role: item.role as 'user' | 'assistant',
                content: item.content,
              })),
            retrievedChunks,
            latestUserMessage: message,
          })

          const assistantMessage = await streamGeminiResponse(prompt, (token) => {
            controller.enqueue(encoder.encode(createSseEvent('token', { text: token })))
          })

          await supabase.from('messages').insert({
            profile_id: user.id,
            baby_id: baby.id,
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantMessage,
            sources_used: sources,
            safety_note: safety.safetyNote,
            is_emergency_redirect: false,
            confidence,
            model: CHAT_MODEL,
          })
          assistantPersisted = true

          controller.enqueue(
            encoder.encode(
              createSseEvent('done', {
                message: assistantMessage,
                sources,
                safety_note: safety.safetyNote,
                is_emergency_redirect: false,
                confidence,
                conversation_id: conversationId,
              })
            )
          )
          controller.close()
        } catch (error) {
          if (quotaConsumed && !assistantPersisted) {
            await releaseChatQuota(user.id, timezone).catch(() => {})
          }

          const messageText =
            error instanceof Error ? error.message : 'Chat failed unexpectedly'
          controller.enqueue(
            encoder.encode(
              createSseEvent('error', {
                error:
                  'Something went wrong while generating advice. Please try again in a moment.',
                detail: messageText,
              })
            )
          )
          controller.close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
