import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDateStringForTimezone, normalizeDailyPlanRow, summarizeDailyPlanForPrompt } from '@/lib/daily-plan'
import { buildChatPrompt } from '@/lib/ai/prompt'
import {
  containsConflictingQuestionAge,
  parseQuestionStatedAge,
  rewriteConflictingQuestionAge,
} from '@/lib/ai/age-override'
import { summarizeSleepPlanProfileForPrompt } from '@/lib/sleep-plan-chat-updates'
import {
  generateEmbedding,
  retrieveRelevantChunksWithDiagnostics,
  type SleepMethodology,
} from '@/lib/ai/retrieval'
import { checkEmergencyRisk, getEmergencyRedirectMessage } from '@/lib/ai/safety'
import { buildSleepScorePromptSummary, calculateSleepScore, getAgeBand, getSleepScoreLookbackStart, SLEEP_SCORE_FETCH_LIMIT } from '@/lib/scoring/sleep-score'
import { buildDailyLimitPayload, consumeChatQuota, releaseChatQuota, sanitizeTimezone } from '@/lib/billing/usage'
import { ensureSubscriptionRecord, hasPremiumAccess } from '@/lib/billing/subscriptions'
import { ensureSleepPlanProfile } from '@/lib/sleep-plan-profile-init'
import { parseNightFeeds } from '@/lib/onboarding-preferences'
import { CHAT_MODEL, clampChatMessage, streamGeminiResponse } from '@/lib/ai/gemini'
import { persistAiMemoryAfterChat, saveChatPlanUpdates } from '@/lib/ai/chat-plan-persistence'
import {
  containsForbiddenResponsePhrase,
  containsUnsafeMedicationPermission,
  createResponseTokenFilter,
  filterResponse,
  hasMedicationContext,
} from '@/lib/ai/response-filter'
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
import { createLatencyTimer } from '@/lib/ai/latency-timing'

function looksIncompleteAssistantResponse(text: string) {
  const stripped = text.trim()
  if (!stripped) {
    return true
  }

  if (stripped.split(/\s+/).length < 60) {
    return true
  }

  if (
    ['check-in:', 'check in:', 'what to try tonight:'].some((ending) =>
      stripped.toLowerCase().endsWith(ending)
    )
  ) {
    return true
  }

  return !/[.!?)"']$/.test(stripped)
}

export async function POST(request: Request) {
  const timing = createLatencyTimer()
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
  const logLatencyDiagnostics = isEvalMode || process.env.SOMNI_LOG_LATENCY === 'true'

  const conversationId = resolveConversationId(body.conversationId)
  timing.setMetadata({
    conversation_id: conversationId,
    model_provider: 'gemini',
    model_name: CHAT_MODEL,
    eval_mode: isEvalMode,
  })

  const { supabase, user } = await timing.time('auth_session_lookup', async () => {
    const client = await createClient()
    const {
      data: { user: authUser },
    } = await client.auth.getUser()

    return {
      supabase: client,
      user: authUser,
    }
  })

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [profileResult, babyResult] = await timing.time('profile_baby_lookup', () =>
    Promise.all([
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
  )

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

  const safety = checkEmergencyRisk(message)
  const queryEmbeddingPromise = safety.isEmergency
    ? Promise.resolve<number[] | null>(null)
    : timing.time('embedding_creation', () => generateEmbedding(message))

  const timezone = sanitizeTimezone(profile.timezone)
  const localToday = getDateStringForTimezone(timezone)
  const contextLoadPromise = timing.time('profile_context_load', () =>
    Promise.all([
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
  )
  const [
    [
      subscription,
      preferencesResult,
      currentDailyPlanResult,
      recentSleepLogsResult,
      recentMessagesResult,
    ],
    precomputedQueryEmbedding,
  ] = await Promise.all([contextLoadPromise, queryEmbeddingPromise])

  const { data: preferences } = preferencesResult
  const { data: currentDailyPlanRow } = currentDailyPlanResult
  const { data: recentSleepLogs } = recentSleepLogsResult
  const { data: recentMessages } = recentMessagesResult

  let quotaConsumed = false
  if (!hasPremiumAccess(subscription)) {
    const quota = await timing.time('quota_lookup', () => consumeChatQuota(user.id, timezone))
    if (!quota.allowed) {
      return Response.json(buildDailyLimitPayload(quota), { status: 429 })
    }
    quotaConsumed = true
  }

  const { profile: currentSleepPlanProfile } = await timing.time(
    'sleep_plan_profile_load',
    () =>
      ensureSleepPlanProfile({
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
  )

  const currentDailyPlan = normalizeDailyPlanRow(currentDailyPlanRow)

  const userInsert = await timing.time('persistence_database_write', async () =>
    await supabase.from('messages').insert({
      profile_id: user.id,
      baby_id: baby.id,
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })
  )

  if (userInsert.error) {
    if (quotaConsumed) {
      await releaseChatQuota(user.id, timezone).catch(() => {})
    }
    return Response.json({ error: userInsert.error.message }, { status: 500 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        let assistantPersisted = false
        let retryCount = 0
        const retryReasons: string[] = []

        try {
          if (safety.isEmergency) {
            const assistantMessage = getEmergencyRedirectMessage(safety.route)
            const sources: SourceAttribution[] = []

            await timing.time('persistence_database_write', async () =>
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
            )
            assistantPersisted = true
            timing.mark('response_complete')
            const timingPayload = timing.snapshot({
              retry_count: retryCount,
              retry_reason: '',
              response_character_count: assistantMessage.length,
              selected_source_count: sources.length,
              model_name: 'safety-guardrail',
            })
            if (logLatencyDiagnostics) {
              console.info('[chat] latency', JSON.stringify(timingPayload))
            }

            controller.enqueue(
              encoder.encode(
                createSseEvent('done', {
                  message: assistantMessage,
                  sources,
                  safety_note: safety.safetyNote,
                  is_emergency_redirect: true,
                  confidence: 'high',
                  conversation_id: conversationId,
                  timing: timingPayload,
                })
              )
            )
            controller.close()
            return
          }

          const profileAgeBand = getAgeBand(baby.date_of_birth)
          const questionStatedAge = timing.timeSync('latest_message_age_extraction', () =>
            parseQuestionStatedAge(message)
          )
          const ageBand = questionStatedAge?.ageBand ?? profileAgeBand
          const sleepStyleLabel =
            (preferences?.sleep_style_label as SleepMethodology | null) ?? 'all'
          const retrievalResult = await timing.time('retrieval_total', () =>
            retrieveRelevantChunksWithDiagnostics({
              query: message,
              ageBand,
              methodology: sleepStyleLabel,
              limit: 5,
              queryEmbedding: precomputedQueryEmbedding,
            })
          )
          const retrievedChunks = retrievalResult.chunks
          const retrievalDiagnostics = retrievalResult.diagnostics
          timing.add('retrieval_rpc_vector_search', retrievalDiagnostics.timing?.rpcSeconds)
          timing.add('retrieval_fallback_fetch', retrievalDiagnostics.timing?.fallbackFetchSeconds)
          timing.add('retrieval_fallback_score', retrievalDiagnostics.timing?.fallbackScoreSeconds)
          timing.add(
            'retrieval_rerank_source_selection',
            retrievalDiagnostics.timing?.rerankSeconds
          )

          if (logRetrievalDiagnostics) {
            console.info(
              '[chat] retrieval',
              JSON.stringify(buildRetrievalLogPayload(retrievalDiagnostics, conversationId))
            )
          }

          const sources = toSourceAttribution(retrievedChunks)
          const confidence = getConfidenceLabel(retrievedChunks.length)
          const primaryPrompt = timing.timeSync('prompt_assembly', () => {
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
              profileAgeBand,
              questionStatedAge: questionStatedAge?.label ?? null,
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
                .slice(-4)
                .map((item) => ({
                  role: item.role as 'user' | 'assistant',
                  content: item.content,
                })),
              retrievedChunks,
              latestUserMessage: message,
            }

            return buildChatPrompt(promptContext)
          })

          const estimatedPrimaryPromptTokens = Math.ceil(primaryPrompt.length / 4)
          timing.setMetadata({
            prompt_character_count: primaryPrompt.length,
            prompt_token_estimate: estimatedPrimaryPromptTokens,
            selected_source_count: sources.length,
          })
          console.log('[chat] primary prompt token estimate', {
            conversationId,
            promptChars: primaryPrompt.length,
            estimatedPromptTokens: estimatedPrimaryPromptTokens,
          })

          const shouldHoldStreamingForMedicationSafety = hasMedicationContext(message)
          let streamedFirstToken = false
          let modelFirstToken = false
          const primaryTokenFilter = createResponseTokenFilter((token) => {
            if (shouldHoldStreamingForMedicationSafety) {
              return
            }

            if (!streamedFirstToken) {
              streamedFirstToken = true
              timing.mark('time_to_first_token')
            }
            controller.enqueue(
              encoder.encode(createSseEvent('token', { text: token, message_index: 1 }))
            )
          })

          timing.mark('primary_model_call_start')
          timing.start('primary_model_ttft')
          let primaryGeminiResult = await timing.time('primary_model_call', () =>
            streamGeminiResponse(
              [{ role: 'user', parts: [{ text: primaryPrompt }] }],
              isEvalMode,
              sleepStyleLabel,
              (token: string) => {
                if (!modelFirstToken) {
                  modelFirstToken = true
                  timing.end('primary_model_ttft')
                  timing.mark('primary_model_first_token')
                }
                primaryTokenFilter.push(token)
              }
            )
          )
          primaryTokenFilter.flush()

          if (containsUnsafeMedicationPermission(primaryGeminiResult.text, message)) {
            retryCount += 1
            retryReasons.push('unsafe_medication_permission')
            const retryResult = await timing.time('retry_or_rewrite_pass', () =>
              streamGeminiResponse(
                [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `${primaryPrompt}\n\nRewrite the parent-facing response one time. Keep the same advice, but use the opening confidence policy above, avoid the recurring sound-based hedge, and do not authorise medication use. For medication, say it may be commonly used in some situations, follow the label and age/weight dosing instructions, check with a GP/pharmacist/child health nurse if unsure, seek medical advice for concerning symptoms, and pause sleep coaching while pain or illness is being handled.`,
                      },
                    ],
                  },
                ],
                true,
                sleepStyleLabel,
                () => {}
              )
            )

            if (retryResult.text.trim()) {
              primaryGeminiResult = {
                ...primaryGeminiResult,
                text: retryResult.text,
              }
            }
          }

          const filteredPrimary = timing.timeSync('response_validation_filtering', () => ({
            message: filterResponse(primaryGeminiResult.text, message),
            hasForbiddenPhrase: containsForbiddenResponsePhrase(primaryGeminiResult.text, message),
          }))
          let primaryAssistantMessage = filteredPrimary.message
          let replacePrimaryMessage =
            primaryAssistantMessage !== primaryGeminiResult.text.trim() ||
            filteredPrimary.hasForbiddenPhrase ||
            shouldHoldStreamingForMedicationSafety

          const savedPlanUpdates = await timing.time('persistence_database_write', () =>
            saveChatPlanUpdates({
              supabase,
              currentPlan: currentDailyPlan,
              currentProfile: currentSleepPlanProfile,
              babyId: baby.id,
              babyName: baby.name,
              planDate: localToday,
              functionCalls: primaryGeminiResult.functionCalls,
              userMessage: message,
            })
          )

          if (savedPlanUpdates.assistantMessage) {
            primaryAssistantMessage = filterResponse(savedPlanUpdates.assistantMessage, message)
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

          if (looksIncompleteAssistantResponse(primaryAssistantMessage)) {
            retryCount += 1
            retryReasons.push('incomplete_primary_response')
            const retryResult = await timing.time('retry_or_rewrite_pass', () =>
              streamGeminiResponse(
                [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `${primaryPrompt}\n\nRewrite the parent-facing response one time as a complete answer. Keep the same safety boundaries, use practical steps, finish every list item, include a short check-in sentence, and keep the recurring sound-based hedge banned.`,
                      },
                    ],
                  },
                ],
                true,
                sleepStyleLabel,
                () => {}
              )
            )
            const retriedMessage = filterResponse(retryResult.text, message)

            if (retriedMessage && !looksIncompleteAssistantResponse(retriedMessage)) {
              primaryAssistantMessage = retriedMessage
            }
            replacePrimaryMessage = true
          }

          if (containsConflictingQuestionAge(primaryAssistantMessage, questionStatedAge)) {
            retryCount += 1
            retryReasons.push('conflicting_question_age')
            const retryResult = await timing.time('retry_or_rewrite_pass', () =>
              streamGeminiResponse(
                [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `${primaryPrompt}\n\nRewrite the parent-facing response one time. Keep the same advice and safety boundaries, but correct the age handling. The latest parent message states the child is ${questionStatedAge?.label}; use that age for the current answer and do not mention any conflicting profile age from stored memory, logs, or prior context. Also keep the recurring sound-based hedge banned.`,
                      },
                    ],
                  },
                ],
                true,
                sleepStyleLabel,
                () => {}
              )
            )
            const retriedMessage = filterResponse(retryResult.text, message)

            primaryAssistantMessage =
              retriedMessage && !containsConflictingQuestionAge(retriedMessage, questionStatedAge)
                ? retriedMessage
                : rewriteConflictingQuestionAge(primaryAssistantMessage, questionStatedAge)
            replacePrimaryMessage = true
          }

          await timing.time('persistence_database_write', async () =>
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
          )
          assistantPersisted = true
          timing.mark('response_complete')
          const timingPayload = timing.snapshot({
            retry_count: retryCount,
            retry_reason: retryReasons.join('|'),
            response_character_count: primaryAssistantMessage.length,
          })
          if (logLatencyDiagnostics) {
            console.info('[chat] latency', JSON.stringify(timingPayload))
          }

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
                timing: timingPayload,
              })
            )
          )

          const memoryPersistencePromise = persistAiMemoryAfterChat({
            supabase,
            profileId: user.id,
            babyId: baby.id,
            babyName: baby.name,
            conversationId,
            fallbackUserMessage: message,
            fallbackAssistantMessage: primaryAssistantMessage,
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
          timing.mark('response_complete')
          const timingPayload = timing.snapshot({
            retry_count: retryCount,
            retry_reason: retryReasons.join('|'),
          })
          if (logLatencyDiagnostics) {
            console.info('[chat] latency_error', JSON.stringify(timingPayload))
          }
          controller.enqueue(
            encoder.encode(
              createSseEvent('error', {
                error:
                  'Something went wrong while generating advice. Please try again in a moment.',
                detail: messageText,
                timing: timingPayload,
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
