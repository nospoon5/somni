import { createRequestLogger } from '@/lib/observability/logger'
import { createClient } from '@/lib/supabase/server'
import { getDateStringForTimezone } from '@/lib/daily-plan'
import { generateEmbedding } from '@/lib/ai/retrieval'
import { checkEmergencyRisk } from '@/lib/ai/safety'
import { getAgeBand, getSleepScoreLookbackStart, SLEEP_SCORE_FETCH_LIMIT } from '@/lib/scoring/sleep-score'
import { buildDailyLimitPayload, consumeChatQuota, releaseChatQuota, sanitizeTimezone } from '@/lib/billing/usage'
import {
  ensureSubscriptionRecord,
  hasPremiumAccess,
  readSubscriptionRecord,
} from '@/lib/billing/subscriptions'
import { ensureSleepPlanProfile, readSleepPlanProfile } from '@/lib/sleep-plan-profile-init'
import {
  normalizeDayStructure,
  normalizeNapPattern,
  normalizeSchedulePreference,
  normalizeSleepStyleLabel,
  parseNightFeeds,
} from '@/lib/onboarding-preferences'
import { CHAT_MODEL, clampChatMessage } from '@/lib/ai/gemini'
import {
  shouldIncludeRetrievalDiagnostics,
  shouldLogRetrievalDiagnostics,
} from '@/lib/ai/chat-sources'
import {
  readBabyId,
  readChatMessage,
  readEvalHistory,
  resolveConversationId,
  type ChatRequestBody,
} from '@/lib/ai/chat-request'
import { createLatencyTimer } from '@/lib/ai/latency-timing'
import { createChatPipeline } from '@/lib/ai/chat-pipeline'
import { readActiveBabyId } from '@/lib/babies/active-baby'
import { authorizeEvalRequest } from '@/lib/ai/eval-auth'
import { getAgeInWeeks, getUtcDateString } from '@/lib/date-utils'

export async function POST(request: Request) {
  const reqLogger = createRequestLogger({ endpoint: '/api/chat' })
  const timing = createLatencyTimer()
  let body: ChatRequestBody

  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = clampChatMessage(readChatMessage(body.message))
  const requestedBabyId = readBabyId(body.babyId)

  if (!message) {
    return Response.json({ error: 'Message is required' }, { status: 400 })
  }

  if (body.babyId != null && !requestedBabyId) {
    return Response.json({ error: 'Invalid baby selection' }, { status: 400 })
  }

  const evalAuthorization = authorizeEvalRequest(request)
  if (evalAuthorization.requested && !evalAuthorization.authorized) {
    return Response.json({ error: 'Evaluation request is not authorized' }, { status: 403 })
  }

  const isEvalMode = evalAuthorization.authorized
  const evalHistory = isEvalMode ? readEvalHistory(body.evalHistory) : []
  const includeRetrievalDiagnostics = shouldIncludeRetrievalDiagnostics(isEvalMode)
  const logRetrievalDiagnostics = shouldLogRetrievalDiagnostics(isEvalMode)
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

  const preferredBabyId = requestedBabyId ?? (await readActiveBabyId())

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
        .order('created_at', { ascending: true }),
    ])
  )

  const { data: profile, error: profileError } = profileResult
  const { data: babies, error: babyError } = babyResult
  const baby = preferredBabyId
    ? babies?.find((candidate) => candidate.id === preferredBabyId) ?? null
    : babies?.[0] ?? null

  if (profileError) {
    reqLogger.error('Failed to load profile', { userId: user.id }, profileError, true)
    return Response.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile?.onboarding_completed) {
    return Response.json({ error: 'Onboarding incomplete' }, { status: 409 })
  }

  if (babyError) {
    reqLogger.error('Failed to load baby profile', { userId: user.id }, babyError, true)
    return Response.json({ error: babyError.message }, { status: 500 })
  }

  if (preferredBabyId && !baby) {
    return Response.json({ error: 'You no longer have access to this baby.' }, { status: 403 })
  }

  if (!baby) {
    return Response.json({ error: 'Baby profile missing' }, { status: 404 })
  }

  const safety = checkEmergencyRisk(message, {
    babyAgeWeeks: getAgeInWeeks(baby.date_of_birth, getUtcDateString()),
  })
  const queryEmbeddingPromise = safety.isEmergency
    ? Promise.resolve<number[] | null>(null)
    : timing.time('embedding_creation', () => generateEmbedding(message))

  const timezone = sanitizeTimezone(profile.timezone)
  const localToday = getDateStringForTimezone(timezone)
  const contextLoadPromise = timing.time('profile_context_load', () =>
    Promise.all([
      isEvalMode
        ? readSubscriptionRecord({ profileId: user.id })
        : ensureSubscriptionRecord({
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
        .select(
          'id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at, pending_rescue_targets, rescue_dismissed'
        )
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
      isEvalMode
        ? Promise.resolve({ data: evalHistory, error: null })
        : supabase
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
  if (!isEvalMode && !hasPremiumAccess(subscription)) {
    const quota = await timing.time('quota_lookup', () => consumeChatQuota(user.id, timezone))
    if (!quota.allowed) {
      return Response.json(buildDailyLimitPayload(quota), { status: 429 })
    }
    quotaConsumed = true
  }

  const currentSleepPlanProfile = await timing.time('sleep_plan_profile_load', async () => {
    if (isEvalMode) {
      return readSleepPlanProfile({ supabase, babyId: baby.id })
    }

    const result = await ensureSleepPlanProfile({
        supabase,
        source: 'system',
        id: baby.id,
        name: baby.name,
        dateOfBirth: baby.date_of_birth,
        sleepStyleLabel: normalizeSleepStyleLabel(preferences?.sleep_style_label),
        typicalWakeTime:
          typeof preferences?.typical_wake_time === 'string' ? preferences.typical_wake_time : null,
        dayStructure: normalizeDayStructure(preferences?.day_structure),
        napPattern: normalizeNapPattern(preferences?.nap_pattern),
        nightFeeds: parseNightFeeds(preferences?.night_feeds),
        schedulePreference: normalizeSchedulePreference(preferences?.schedule_preference),
      })

    return result.profile
  })

  if (!isEvalMode) {
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
      reqLogger.error('Failed to persist user message', { userId: user.id }, userInsert.error, true)
      if (quotaConsumed) {
        await releaseChatQuota(user.id, timezone).catch(() => {})
      }
      return Response.json({ error: userInsert.error.message }, { status: 500 })
    }
  }

  const stream = createChatPipeline({
    supabase,
    userId: user.id,
    profileAgeBand: getAgeBand(baby.date_of_birth),
    profile,
    baby,
    preferences: preferences ?? null,
    currentSleepPlanProfile: currentSleepPlanProfile ?? null,
    currentDailyPlan: currentDailyPlanRow ?? null,
    recentSleepLogs: recentSleepLogs ?? [],
    recentMessages: recentMessages ?? [],
    message,
    conversationId,
    safety,
    precomputedQueryEmbedding,
    timezone,
    localToday,
    isEvalMode,
    logLatencyDiagnostics,
    logRetrievalDiagnostics,
    includeRetrievalDiagnostics,
    quotaConsumed,
    timing,
    signal: request.signal,
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
