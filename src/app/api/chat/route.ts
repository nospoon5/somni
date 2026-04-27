import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDateStringForTimezone, normalizeDailyPlanRow, summarizeDailyPlanForPrompt } from '@/lib/daily-plan'
import { buildChatFollowUpPrompt, buildChatPrompt } from '@/lib/ai/prompt'
import { summarizeSleepPlanProfileForPrompt } from '@/lib/sleep-plan-chat-updates'
import { retrieveRelevantChunksWithDiagnostics, type SleepMethodology } from '@/lib/ai/retrieval'
import { checkEmergencyRisk, getEmergencyRedirectMessage } from '@/lib/ai/safety'
import { buildSleepScorePromptSummary, calculateSleepScore, getAgeBand, getSleepScoreLookbackStart, SLEEP_SCORE_FETCH_LIMIT } from '@/lib/scoring/sleep-score'
import { buildDailyLimitPayload, consumeChatQuota, releaseChatQuota, sanitizeTimezone } from '@/lib/billing/usage'
import { ensureSubscriptionRecord, hasPremiumAccess } from '@/lib/billing/subscriptions'
import { ensureSleepPlanProfile } from '@/lib/sleep-plan-profile-init'
import { parseNightFeeds } from '@/lib/onboarding-preferences'
import { CHAT_MODEL, clampChatMessage, streamGeminiResponse } from '@/lib/ai/gemini'
import { persistAiMemoryAfterChat, saveChatPlanUpdates } from '@/lib/ai/chat-plan-persistence'
import { filterResponse } from '@/lib/ai/response-filter'
import {
  buildRetrievalLogPayload,
  createSseEvent,
  getConfidenceLabel,
  getRecentSleepSummary,
  shouldIncludeRetrievalDiagnostics,
  shouldLogRetrievalDiagnostics,
  toSourceAttribution,
  type SourceAttribution,
} from '@/lib/ai/chat-sources'
import { readChatMessage, resolveConversationId, type ChatRequestBody } from '@/lib/ai/chat-request'

export async function POST(request: Request) {
  let body: ChatRequestBody

  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = clampChatMessage(readChatMessage(body.message))

  if (!message) {
    return Response.json({ error: 'Message is required' }, { status: 400 })
  }

  const isEvalMode = request.headers.get('x-eval-mode') === 'true'
  const includeRetrievalDiagnostics = shouldIncludeRetrievalDiagnostics(request, isEvalMode)
  const logRetrievalDiagnostics = shouldLogRetrievalDiagnostics(request, isEvalMode)

  const conversationId = resolveConversationId(body.conversationId)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [profileResult, babyResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, onboarding_completed, timezone')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('babies')
      .select('id, name, date_of_birth, ai_memory, biggest_issue, feeding_type, bedtime_range')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const { data: profile, error: profileError } = profileResult
  const { data: baby, error: babyError } = babyResult

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile?.onboarding_completed) {
    return Response.json({ error: 'Onboarding incomplete' }, { status: 409 })
  }

  if (babyError) {
    return Response.json({ error: babyError.message }, { status: 500 })
  }

  if (!baby) {
    return Response.json({ error: 'Baby profile missing' }, { status: 404 })
  }

  const timezone = sanitizeTimezone(profile.timezone)
  const localToday = getDateStringForTimezone(timezone)
  const [
    subscription,
    preferencesResult,
    currentDailyPlanResult,
    recentSleepLogsResult,
    recentMessagesResult,
  ] = await Promise.all([
    ensureSubscriptionRecord({
      profileId: user.id,
      email: profile.email ?? user.email ?? null,
    }),
    supabase
      .from('onboarding_preferences')
      .select(
        'sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference'
      )
      .eq('baby_id', baby.id)
      .maybeSingle(),
    supabase
      .from('daily_plans')
      .select('id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at')
      .eq('baby_id', baby.id)
      .eq('plan_date', localToday)
      .maybeSingle(),
    supabase
      .from('sleep_logs')
      .select('started_at, ended_at, is_night, tags')
      .eq('baby_id', baby.id)
      .gte('started_at', getSleepScoreLookbackStart().toISOString())
      .order('started_at', { ascending: false })
      .limit(SLEEP_SCORE_FETCH_LIMIT),
    supabase
      .from('messages')
      .select('role, content')
      .eq('profile_id', user.id)
      .eq('baby_id', baby.id)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(8),
  ])

  const { data: preferences } = preferencesResult
  const { data: currentDailyPlanRow } = currentDailyPlanResult
  const { data: recentSleepLogs } = recentSleepLogsResult
  const { data: recentMessages } = recentMessagesResult

  let quotaConsumed = false
  if (!hasPremiumAccess(subscription)) {
    const quota = await consumeChatQuota(user.id, timezone)
    if (!quota.allowed) {
      return Response.json(buildDailyLimitPayload(quota), { status: 429 })
    }
    quotaConsumed = true
  }

  const { profile: currentSleepPlanProfile } = await ensureSleepPlanProfile({
    supabase,
    source: 'system',
    id: baby.id,
    name: baby.name,
    dateOfBirth: baby.date_of_birth,
    sleepStyleLabel: preferences?.sleep_style_label ?? null,
    typicalWakeTime:
      typeof preferences?.typical_wake_time === 'string' ? preferences.typical_wake_time : null,
    dayStructure: preferences?.day_structure ?? null,
    napPattern: preferences?.nap_pattern ?? null,
    nightFeeds: parseNightFeeds(preferences?.night_feeds),
    schedulePreference: preferences?.schedule_preference ?? null,
  })

  const currentDailyPlan = normalizeDailyPlanRow(currentDailyPlanRow)

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
          const sleepStyleLabel =
            (preferences?.sleep_style_label as SleepMethodology | null) ?? 'all'
          const retrievalResult = await retrieveRelevantChunksWithDiagnostics({
            query: message,
            ageBand,
            methodology: sleepStyleLabel,
            limit: 5,
          })
          const retrievedChunks = retrievalResult.chunks
          const retrievalDiagnostics = retrievalResult.diagnostics

          if (logRetrievalDiagnostics) {
            console.info(
              '[chat] retrieval',
              JSON.stringify(buildRetrievalLogPayload(retrievalDiagnostics, conversationId))
            )
          }

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

          const promptContext = {
            babyName: baby.name,
            ageBand,
            sleepStyleLabel,
            timezone,
            localToday,
            aiMemory: baby.ai_memory ?? null,
            durableProfileSummary: summarizeSleepPlanProfileForPrompt(currentSleepPlanProfile),
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
          }

          const primaryPrompt = buildChatPrompt(promptContext)

          const estimatedPrimaryPromptTokens = Math.ceil(primaryPrompt.length / 4)
          console.log('[chat] primary prompt token estimate', {
            conversationId,
            promptChars: primaryPrompt.length,
            estimatedPromptTokens: estimatedPrimaryPromptTokens,
          })

          const primaryGeminiResult = await streamGeminiResponse(
            [{ role: 'user', parts: [{ text: primaryPrompt }] }],
            isEvalMode,
            sleepStyleLabel,
            (token: string) => {
              controller.enqueue(
                encoder.encode(createSseEvent('token', { text: token, message_index: 1 }))
              )
            }
          )

          let primaryAssistantMessage = filterResponse(primaryGeminiResult.text)
          let replacePrimaryMessage = false

          const savedPlanUpdates = await saveChatPlanUpdates({
            supabase,
            currentPlan: currentDailyPlan,
            currentProfile: currentSleepPlanProfile,
            babyId: baby.id,
            babyName: baby.name,
            planDate: localToday,
            functionCalls: primaryGeminiResult.functionCalls,
            userMessage: message,
          })

          if (savedPlanUpdates.assistantMessage) {
            primaryAssistantMessage = filterResponse(savedPlanUpdates.assistantMessage)
            replacePrimaryMessage = true
          }

          if (savedPlanUpdates.streamPayload) {
            controller.enqueue(
              encoder.encode(createSseEvent('plan_updated', savedPlanUpdates.streamPayload))
            )
          }

          if (!primaryAssistantMessage) {
            primaryAssistantMessage =
              "I'm missing one key detail before I can shape today's plan. Tell me the one target you want to lock in first, and I'll tighten it up with you."
          }

          await supabase.from('messages').insert({
            profile_id: user.id,
            baby_id: baby.id,
            conversation_id: conversationId,
            role: 'assistant',
            content: primaryAssistantMessage,
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
                message: primaryAssistantMessage,
                sources,
                safety_note: safety.safetyNote,
                is_emergency_redirect: false,
                confidence,
                conversation_id: conversationId,
                replace_message: replacePrimaryMessage,
                message_index: 1,
                retrieval: includeRetrievalDiagnostics ? retrievalDiagnostics : undefined,
              })
            )
          )

          let secondaryAssistantMessage = ''
          const shouldGenerateFollowUp = /what to try tonight/i.test(primaryAssistantMessage)

          if (shouldGenerateFollowUp) {
            try {
              const followUpPrompt = buildChatFollowUpPrompt({
                ...promptContext,
                primaryMessage: primaryAssistantMessage,
              })

              const estimatedFollowUpPromptTokens = Math.ceil(followUpPrompt.length / 4)
              console.log('[chat] follow-up prompt token estimate', {
                conversationId,
                promptChars: followUpPrompt.length,
                estimatedPromptTokens: estimatedFollowUpPromptTokens,
              })

              let streamedFollowUpChars = 0
              let streamedFollowUpSeparator = false

              const followUpResult = await streamGeminiResponse(
                [{ role: 'user', parts: [{ text: followUpPrompt }] }],
                true,
                sleepStyleLabel,
                (token: string) => {
                  streamedFollowUpChars += token.length
                  if (!streamedFollowUpSeparator) {
                    streamedFollowUpSeparator = true
                    // Keep legacy single-bubble clients readable while follow-up streams.
                    controller.enqueue(
                      encoder.encode(createSseEvent('token', { text: '\n\n', message_index: 2 }))
                    )
                  }
                  controller.enqueue(
                    encoder.encode(createSseEvent('token', { text: token, message_index: 2 }))
                  )
                }
              )

              secondaryAssistantMessage = filterResponse(followUpResult.text)
              if (!secondaryAssistantMessage) {
                secondaryAssistantMessage =
                  "What compromise is okay: It's okay to choose the gentlest option that keeps everyone calm tonight.\nCheck-in: Check in with me tomorrow and we'll tweak the plan together."
              }

              if (streamedFollowUpChars === 0) {
                controller.enqueue(
                  encoder.encode(
                    createSseEvent('token', {
                      text: `\n\n${secondaryAssistantMessage}`,
                      message_index: 2,
                    })
                  )
                )
              }

              await supabase.from('messages').insert({
                profile_id: user.id,
                baby_id: baby.id,
                conversation_id: conversationId,
                role: 'assistant',
                content: secondaryAssistantMessage,
                sources_used: sources,
                safety_note: safety.safetyNote,
                is_emergency_redirect: false,
                confidence,
                model: CHAT_MODEL,
              })

              controller.enqueue(
                encoder.encode(
                  createSseEvent('done', {
                    message: secondaryAssistantMessage,
                    sources,
                    safety_note: safety.safetyNote,
                    is_emergency_redirect: false,
                    confidence,
                    conversation_id: conversationId,
                    message_index: 2,
                  })
                )
              )
            } catch (followUpError) {
              console.error('[chat] follow-up generation failed', followUpError)
            }
          }

          const memoryPersistencePromise = persistAiMemoryAfterChat({
            supabase,
            profileId: user.id,
            babyId: baby.id,
            babyName: baby.name,
            conversationId,
            fallbackUserMessage: message,
            fallbackAssistantMessage: secondaryAssistantMessage || primaryAssistantMessage,
          })

          // Ensure the isolate stays alive on Vercel to finish the memory update
          after(async () => {
            try {
              await memoryPersistencePromise
            } catch (error) {
              console.error('[MemoryPersistence] Background task failed:', error)
            }
          })

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
