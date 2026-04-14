import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildDailyPlanConfirmation,
  getDateStringForTimezone,
  hasDailyPlanChanges,
  mergeDailyPlan,
  normalizeDailyPlanRow,
  normalizeDailyPlanUpdateInput,
  summarizeDailyPlanForPrompt,
  type DailyPlanRecord,
} from '@/lib/daily-plan'
import { buildChatPrompt } from '@/lib/ai/prompt'
import { extractUpdatedAiMemory } from '@/lib/ai/memory'
import { retrieveRelevantChunks, type SleepMethodology } from '@/lib/ai/retrieval'
import { checkEmergencyRisk, getEmergencyRedirectMessage } from '@/lib/ai/safety'
import {
  buildSleepScorePromptSummary,
  calculateSleepScore,
  getAgeBand,
  getSleepScoreLookbackStart,
  SLEEP_SCORE_FETCH_LIMIT,
} from '@/lib/scoring/sleep-score'
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
const UPDATE_DAILY_PLAN_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'update_daily_plan',
        description:
          "Save or revise today's dashboard target plan for the current baby. Use this when the parent gives a concrete same-day schedule or feed change that should be reflected on the dashboard.",
        parameters: {
          type: 'object',
          properties: {
            sleep_targets: {
              type: 'array',
              description:
                'Only include sleep targets that should be created or changed. Omit this field to leave sleep targets unchanged. Use an empty array only if the sleep plan should be cleared.',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description:
                      'Short target label such as Morning nap, Lunch nap, Afternoon nap, Bedtime, Overnight resettle.',
                  },
                  target_time: {
                    type: 'string',
                    description:
                      "Preferred target time in a parent-friendly format such as 3pm, 3:15 pm, or 15:00.",
                  },
                  window: {
                    type: 'string',
                    description:
                      'Optional timing window such as 2:45-3:15pm or after lunch.',
                  },
                  notes: {
                    type: 'string',
                    description:
                      'Optional short note explaining the target or cue to watch for.',
                  },
                },
                required: ['label'],
              },
            },
            feed_targets: {
              type: 'array',
              description:
                'Only include feed targets that should be created or changed. Omit this field to leave feed targets unchanged. Use an empty array only if the feed plan should be cleared.',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description:
                      'Short feed label such as Morning feed, Top-up feed, Bedtime feed, Dream feed.',
                  },
                  target_time: {
                    type: 'string',
                    description:
                      "Preferred target time in a parent-friendly format such as 7am, 10:30 am, or 22:00.",
                  },
                  notes: {
                    type: 'string',
                    description:
                      'Optional short note explaining the feed target or change.',
                  },
                },
                required: ['label'],
              },
            },
            notes: {
              type: 'string',
              description:
                "Optional short note that explains today's shift in plan for caregivers.",
            },
          },
        },
      },
    ],
  },
]
const UPDATE_DAILY_PLAN_TOOL_CONFIG = {
  functionCallingConfig: {
    mode: 'AUTO',
  },
}

type ChatRequestBody = {
  message?: unknown
  conversationId?: unknown
}

type SourceAttribution = {
  name: string
  topic: string
}

type GeminiFunctionCall = {
  id: string | undefined
  name: string
  args: Record<string, unknown>
}

type GeminiStreamResult = {
  text: string
  functionCalls: GeminiFunctionCall[]
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

function extractGeminiFunctionCalls(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return []
  }

  const firstCandidate = candidates[0] as {
    content?: {
      parts?: Array<{
        functionCall?: {
          id?: unknown
          name?: unknown
          args?: unknown
        }
      }>
    }
  }

  const parts = firstCandidate?.content?.parts
  if (!Array.isArray(parts)) {
    return []
  }

  return parts
    .map((part) => {
      const call = part?.functionCall
      if (!call || typeof call.name !== 'string') {
        return null
      }

      return {
        id: typeof call.id === 'string' ? call.id : undefined,
        name: call.name,
        args: call.args && typeof call.args === 'object' && !Array.isArray(call.args) ? call.args : {},
      }
    })
    .filter((call): call is GeminiFunctionCall => call !== null)
}

async function streamGeminiResponse(
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  isEvalMode: boolean,
  onToken: (token: string) => void
) {
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
        contents,
        tools: isEvalMode ? undefined : UPDATE_DAILY_PLAN_TOOLS,
        toolConfig: isEvalMode ? undefined : UPDATE_DAILY_PLAN_TOOL_CONFIG,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
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
  const functionCalls: GeminiFunctionCall[] = []
  const seenFunctionCalls = new Set<string>()

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
        const parsedFunctionCalls = extractGeminiFunctionCalls(parsed)

        if (token) {
          fullText += token
          onToken(token)
        }

        for (const functionCall of parsedFunctionCalls) {
          const key = `${functionCall.id ?? 'no-id'}::${functionCall.name}::${JSON.stringify(functionCall.args)}`
          if (seenFunctionCalls.has(key)) {
            continue
          }

          seenFunctionCalls.add(key)
          functionCalls.push(functionCall)
        }
      } catch (e) {
        console.error("JSON PARSE FAILED", (e as Error).message, dataPayload.substring(0, 100));
        // Ignore malformed chunks and continue streaming the rest.
      }
    }
  }

  // Ensure any final data left in buffer is processed if it has not been printed
  if (buffer.trim()) {
    console.error("WARNING: FINAL BUFFER NOT EMPTY", buffer);
  }

  console.log(`Gemini Stream Completed internally. Extracted ${fullText.length} characters.`);

  return {
    text: fullText.trim(),
    functionCalls,
  } satisfies GeminiStreamResult
}

function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

type PersistAiMemoryArgs = {
  supabase: Awaited<ReturnType<typeof createClient>>
  profileId: string
  babyId: string
  babyName: string
  conversationId: string
  fallbackUserMessage: string
  fallbackAssistantMessage: string
}

async function persistAiMemoryAfterChat(args: PersistAiMemoryArgs) {
  try {
    const { data: latestMessages, error: latestMessagesError } = await args.supabase
      .from('messages')
      .select('role, content')
      .eq('profile_id', args.profileId)
      .eq('baby_id', args.babyId)
      .eq('conversation_id', args.conversationId)
      .order('created_at', { ascending: false })
      .limit(8)

    if (latestMessagesError) {
      throw latestMessagesError
    }

    const latestUserMessage =
      latestMessages?.find((item) => item.role === 'user')?.content || args.fallbackUserMessage
    const latestAssistantMessage =
      latestMessages?.find((item) => item.role === 'assistant')?.content ||
      args.fallbackAssistantMessage

    const { data: babyRow, error: babyReadError } = await args.supabase
      .from('babies')
      .select('ai_memory')
      .eq('id', args.babyId)
      .eq('profile_id', args.profileId)
      .maybeSingle()

    if (babyReadError) {
      throw babyReadError
    }

    const updatedMemory = await extractUpdatedAiMemory({
      babyName: args.babyName,
      existingMemory: babyRow?.ai_memory ?? null,
      latestUserMessage,
      latestAssistantMessage,
    })

    if (!updatedMemory) {
      return
    }

    const { error: updateError } = await args.supabase
      .from('babies')
      .update({ ai_memory: updatedMemory })
      .eq('id', args.babyId)
      .eq('profile_id', args.profileId)

    if (updateError) {
      throw updateError
    }
  } catch (error) {
    console.error('[chat] ai_memory persistence failed', error)
  }
}

async function saveDailyPlanForToday(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  currentPlan: DailyPlanRecord | null
  babyId: string
  babyName: string
  planDate: string
  functionCalls: GeminiFunctionCall[]
}) {
  let workingPlan = args.currentPlan
  let hasToolChanges = false

  for (const functionCall of args.functionCalls) {
    if (functionCall.name !== 'update_daily_plan') {
      continue
    }

    const updates = normalizeDailyPlanUpdateInput(functionCall.args)
    if (!updates || !hasDailyPlanChanges(updates)) {
      continue
    }

    workingPlan = mergeDailyPlan(workingPlan, updates, {
      babyId: args.babyId,
      planDate: args.planDate,
      id: workingPlan?.id,
      updatedAt: new Date().toISOString(),
    })
    hasToolChanges = true
  }

  if (!hasToolChanges || !workingPlan) {
    return null
  }

  const { data: savedPlanRow, error: savePlanError } = await args.supabase
    .from('daily_plans')
    .upsert(
      {
        baby_id: args.babyId,
        plan_date: args.planDate,
        sleep_targets: workingPlan.sleepTargets,
        feed_targets: workingPlan.feedTargets,
        notes: workingPlan.notes,
      },
      {
        onConflict: 'baby_id,plan_date',
      }
    )
    .select('id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at')
    .single()

  if (savePlanError) {
    throw savePlanError
  }

  revalidatePath('/dashboard')

  const savedPlan = normalizeDailyPlanRow(savedPlanRow)
  if (!savedPlan) {
    throw new Error('Daily plan save returned an empty payload')
  }

  return {
    plan: savedPlan,
    assistantMessage: buildDailyPlanConfirmation({
      babyName: args.babyName,
      plan: savedPlan,
    }),
    streamPayload: {
      planDate: savedPlan.planDate,
      sleepTargets: savedPlan.sleepTargets,
      feedTargets: savedPlan.feedTargets,
      notes: savedPlan.notes,
      updatedAt: savedPlan.updatedAt,
    },
  }
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

  const isEvalMode = request.headers.get('x-eval-mode') === 'true'

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
    .select('id, name, date_of_birth, ai_memory, biggest_issue, feeding_type, bedtime_range')
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
  const localToday = getDateStringForTimezone(timezone)
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

  const { data: currentDailyPlanRow } = await supabase
    .from('daily_plans')
    .select('id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at')
    .eq('baby_id', baby.id)
    .eq('plan_date', localToday)
    .maybeSingle()

  const currentDailyPlan = normalizeDailyPlanRow(currentDailyPlanRow)

  const { data: recentSleepLogs } = await supabase
    .from('sleep_logs')
    .select('started_at, ended_at, is_night, tags')
    .eq('baby_id', baby.id)
    .gte('started_at', getSleepScoreLookbackStart().toISOString())
    .order('started_at', { ascending: false })
    .limit(SLEEP_SCORE_FETCH_LIMIT)

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
          const scoreSummary = buildSleepScorePromptSummary(sleepScore)

          const prompt = buildChatPrompt({
            babyName: baby.name,
            ageBand,
            sleepStyleLabel:
              (preferences?.sleep_style_label as SleepMethodology | null) ?? 'all',
            timezone,
            localToday,
            aiMemory: baby.ai_memory ?? null,
            todayPlanSummary: summarizeDailyPlanForPrompt(currentDailyPlan),
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

          const geminiRequestContents = [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ]

          const geminiResult = await streamGeminiResponse(geminiRequestContents, isEvalMode, (token: string) => {
            controller.enqueue(encoder.encode(createSseEvent('token', { text: token })))
          })

          let assistantMessage = geminiResult.text
          let replaceMessage = false

          const savedDailyPlan = await saveDailyPlanForToday({
            supabase,
            currentPlan: currentDailyPlan,
            babyId: baby.id,
            babyName: baby.name,
            planDate: localToday,
            functionCalls: geminiResult.functionCalls,
          })

          if (savedDailyPlan) {
            assistantMessage = savedDailyPlan.assistantMessage
            replaceMessage = true

            controller.enqueue(
              encoder.encode(createSseEvent('plan_updated', savedDailyPlan.streamPayload))
            )
          }

          if (!assistantMessage) {
            assistantMessage =
              "I'm missing one key detail before I can shape today's plan. Tell me the one target you want to lock in first, and I'll tighten it up with you."
          }

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

          const memoryPersistencePromise = persistAiMemoryAfterChat({
            supabase,
            profileId: user.id,
            babyId: baby.id,
            babyName: baby.name,
            conversationId,
            fallbackUserMessage: message,
            fallbackAssistantMessage: assistantMessage,
          })

          // Ensure the isolate stays alive on Vercel to finish the memory update
          after(async () => {
            try {
              await memoryPersistencePromise
            } catch (error) {
              console.error('[MemoryPersistence] Background task failed:', error)
            }
          })

          controller.enqueue(
            encoder.encode(
              createSseEvent('done', {
                message: assistantMessage,
                sources,
                safety_note: safety.safetyNote,
                is_emergency_redirect: false,
                confidence,
                conversation_id: conversationId,
                replace_message: replaceMessage,
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
