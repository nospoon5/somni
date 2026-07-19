import { createClient } from '@/lib/supabase/server'
import { extractUpdatedAiMemory } from '@/lib/ai/memory'
import type { DailyPlanRecord } from '@/lib/daily-plan'
import type { SleepPlanProfileRecord } from '@/lib/sleep-plan-profile'
import type { GeminiFunctionCall } from '@/lib/ai/gemini'
import { getSleepScoreLookbackStart } from '@/lib/scoring/sleep-score'
import { maybeApplyLogDrivenAdaptation, type DailyRescuePendingPlan } from '@/lib/sleep-plan-log-adaptation'

type ChatSupabaseClient = Awaited<ReturnType<typeof createClient>>

type SaveChatPlanUpdatesArgs = {
  supabase: ChatSupabaseClient
  userId: string
  currentPlan: DailyPlanRecord | null
  currentProfile: SleepPlanProfileRecord | null
  babyId: string
  babyName: string
  planDate: string
  timezone: string
  functionCalls: GeminiFunctionCall[]
  userMessage: string
}

const MIN_COMPLETED_SLEEP_MS = 60 * 1000
const MAX_COMPLETED_SLEEP_MS = 24 * 60 * 60 * 1000
const MAX_SLEEP_LOG_AGE_MS = 48 * 60 * 60 * 1000
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000

export function normalizeCompletedSleepLogArgs(
  input: Record<string, unknown>,
  now = new Date()
) {
  const startedAt =
    typeof input.started_at === 'string'
      ? input.started_at
      : typeof input.startedAt === 'string'
        ? input.startedAt
        : null
  const endedAt =
    typeof input.ended_at === 'string'
      ? input.ended_at
      : typeof input.endedAt === 'string'
        ? input.endedAt
        : null
  const startedTime = startedAt ? Date.parse(startedAt) : Number.NaN
  const endedTime = endedAt ? Date.parse(endedAt) : Number.NaN
  const nowTime = now.getTime()
  const duration = endedTime - startedTime

  if (
    !Number.isFinite(startedTime) ||
    !Number.isFinite(endedTime) ||
    startedTime < nowTime - MAX_SLEEP_LOG_AGE_MS ||
    endedTime > nowTime + MAX_FUTURE_CLOCK_SKEW_MS ||
    duration < MIN_COMPLETED_SLEEP_MS ||
    duration > MAX_COMPLETED_SLEEP_MS
  ) {
    return null
  }

  return {
    startedAt: new Date(startedTime).toISOString(),
    endedAt: new Date(endedTime).toISOString(),
    isNight:
      typeof input.is_night === 'boolean'
        ? input.is_night
        : typeof input.isNight === 'boolean'
          ? input.isNight
          : false,
    notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, 500) || null : null,
  }
}

export async function calculateChatPlanUpdates(args: SaveChatPlanUpdatesArgs) {
  let hasLoggedSleep = false
  let pendingRescuePlan: DailyRescuePendingPlan | null = null
  const completedSleepLogs = new Map<
    GeminiFunctionCall,
    NonNullable<ReturnType<typeof normalizeCompletedSleepLogArgs>>
  >()

  const mutationPayloads: {
    sleepLog: Record<string, unknown> | null
    profileUpdate: Record<string, unknown> | null
    dailyPlanUpsert: Record<string, unknown> | null
    changeEvents: Record<string, unknown>[]
  } = {
    sleepLog: null,
    profileUpdate: null,
    dailyPlanUpsert: null,
    changeEvents: [],
  }

  for (const functionCall of args.functionCalls) {
    if (functionCall.name !== 'create_completed_sleep_log') continue
    const normalized = normalizeCompletedSleepLogArgs(
      functionCall.args as Record<string, unknown>
    )
    if (!normalized) {
      return {
        plan: args.currentPlan,
        profile: args.currentProfile,
        assistantMessage:
          "I couldn't save that sleep log because the times were missing or outside the safe 48-hour range. Please add it in Sleep so you can review the start and end times before saving.",
        streamPayload: null,
        hasLoggedSleep: false,
        pendingRescuePlan: null,
        mutationPayloads,
      }
    }
    completedSleepLogs.set(functionCall, normalized)
  }

  // Fetch recent sleep logs for today (needed by evaluateSleepPlanAdaptation/maybeApplyLogDrivenAdaptation)
  const { data: recentLogs, error: logsError } = await args.supabase
    .from('sleep_logs')
    .select('started_at, ended_at, is_night, tags, notes')
    .eq('baby_id', args.babyId)
    .gte('started_at', getSleepScoreLookbackStart().toISOString())
    .order('started_at', { ascending: false })

  if (logsError) throw logsError

  for (const functionCall of args.functionCalls) {
    if (functionCall.name === 'create_completed_sleep_log') {
      const normalizedLog = completedSleepLogs.get(functionCall)

      if (normalizedLog) {
        mutationPayloads.sleepLog = {
          baby_id: args.babyId,
          started_at: normalizedLog.startedAt,
          ended_at: normalizedLog.endedAt,
          is_night: normalizedLog.isNight,
          notes: normalizedLog.notes ?? undefined,
          tags: [],
          logged_by: args.userId,
        }
        hasLoggedSleep = true

        const adaptationLogs = (recentLogs ?? []).map((log) => ({
          startedAt: log.started_at,
          endedAt: log.ended_at,
          isNight: log.is_night,
          tags: log.tags ?? [],
          notes: log.notes,
        }))

        // Prepend the new log if it doesn't already exist in the recent logs
        const isNew = !adaptationLogs.some(
          (l) => l.startedAt === normalizedLog.startedAt && l.endedAt === normalizedLog.endedAt
        )
        if (isNew) {
          adaptationLogs.unshift({
            startedAt: normalizedLog.startedAt,
            endedAt: normalizedLog.endedAt,
            isNight: normalizedLog.isNight,
            tags: [],
            notes: normalizedLog.notes ?? undefined,
          })
        }

        const adaptationResult = maybeApplyLogDrivenAdaptation({
          profile: args.currentProfile,
          logs: adaptationLogs,
          planDate: args.planDate,
          timezone: args.timezone,
        })
        
        if (adaptationResult?.type === 'rescue_plan_ready') {
          pendingRescuePlan = adaptationResult
        } else if (adaptationResult?.type === 'profile_adjusted') {
          mutationPayloads.profileUpdate = adaptationResult.profileUpdate
        }
      }
    }
  }

  return {
    plan: args.currentPlan,
    profile: args.currentProfile,
    assistantMessage: null,
    streamPayload: null,
    hasLoggedSleep,
    pendingRescuePlan,
    mutationPayloads,
  }
}

export type PersistAiMemoryArgs = {
  supabase: ChatSupabaseClient
  profileId: string
  babyId: string
  babyName: string
  conversationId: string
  fallbackUserMessage: string
  fallbackAssistantMessage: string
}

export async function persistAiMemoryAfterChat(args: PersistAiMemoryArgs) {
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

    if (updateError) {
      throw updateError
    }
  } catch (error) {
    console.error('[chat] ai_memory persistence failed', error)
  }
}
