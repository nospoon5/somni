import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { extractUpdatedAiMemory } from '@/lib/ai/memory'
import {
  hasDailyPlanChanges,
  mergeDailyPlan,
  normalizeDailyPlanRow,
  normalizeDailyPlanUpdateInput,
  type DailyPlanRecord,
} from '@/lib/daily-plan'
import {
  buildChatPlanUpdateConfirmation,
  buildDailyPlanChangeEvent,
  buildProfileChangeEvent,
  hasSleepPlanProfileChanges,
  inferChatPlanUpdateSignal,
  mergeSleepPlanProfile,
  normalizeSleepPlanProfileUpdateInput,
  shouldApplyDurableProfileUpdate,
} from '@/lib/sleep-plan-chat-updates'
import {
  buildDailyPlanSnapshot,
  buildSleepPlanProfileSnapshot,
  normalizeSleepPlanProfileRow,
  type SleepPlanProfileRecord,
} from '@/lib/sleep-plan-profile'
import type { GeminiFunctionCall } from '@/lib/ai/gemini'

type ChatSupabaseClient = Awaited<ReturnType<typeof createClient>>

const SLEEP_PLAN_PROFILE_SELECT =
  'id, baby_id, age_band, template_key, usual_wake_time, target_bedtime, target_nap_count, wake_window_profile, feed_anchor_profile, schedule_preference, day_structure, adaptation_confidence, learning_state, last_auto_adjusted_at, last_evidence_summary, created_at, updated_at'

type SaveChatPlanUpdatesArgs = {
  supabase: ChatSupabaseClient
  currentPlan: DailyPlanRecord | null
  currentProfile: SleepPlanProfileRecord | null
  babyId: string
  babyName: string
  planDate: string
  functionCalls: GeminiFunctionCall[]
  userMessage: string
}

export async function saveChatPlanUpdates(args: SaveChatPlanUpdatesArgs) {
  let workingPlan = args.currentPlan
  let workingProfile = args.currentProfile
  let hasDailyToolChanges = false
  let hasProfileToolChanges = false
  const signal = inferChatPlanUpdateSignal(args.userMessage)

  for (const functionCall of args.functionCalls) {
    if (functionCall.name === 'update_sleep_plan_profile') {
      if (!workingProfile || !shouldApplyDurableProfileUpdate(signal)) {
        continue
      }

      const updates = normalizeSleepPlanProfileUpdateInput(functionCall.args)
      if (!updates || !hasSleepPlanProfileChanges(updates)) {
        continue
      }

      const nextProfile = mergeSleepPlanProfile(workingProfile, updates, {
        updatedAt: new Date().toISOString(),
      })

      const beforeSnapshot = buildSleepPlanProfileSnapshot(workingProfile)
      const afterSnapshot = buildSleepPlanProfileSnapshot(nextProfile)
      if (JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot)) {
        continue
      }

      workingProfile = nextProfile
      hasProfileToolChanges = true
      continue
    }

    if (functionCall.name !== 'update_daily_plan') {
      continue
    }

    const updates = normalizeDailyPlanUpdateInput(functionCall.args)
    if (!updates || !hasDailyPlanChanges(updates)) {
      continue
    }

    const nextPlan = mergeDailyPlan(workingPlan, updates, {
      babyId: args.babyId,
      planDate: args.planDate,
      id: workingPlan?.id,
      updatedAt: new Date().toISOString(),
    })

    const beforeSnapshot = buildDailyPlanSnapshot(workingPlan) ?? {}
    const afterSnapshot = buildDailyPlanSnapshot(nextPlan) ?? {}
    if (JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot)) {
      continue
    }

    workingPlan = nextPlan
    hasDailyToolChanges = true
  }

  if (!hasDailyToolChanges && !hasProfileToolChanges) {
    return {
      plan: args.currentPlan,
      profile: args.currentProfile,
      assistantMessage: null,
      streamPayload: null,
    }
  }

  let savedProfile = args.currentProfile
  if (hasProfileToolChanges && args.currentProfile && workingProfile) {
    const profileChangeEvent = buildProfileChangeEvent({
      message: args.userMessage,
      beforeProfile: args.currentProfile,
      afterProfile: workingProfile,
    })

    const { data: savedProfileRow, error: saveProfileError } = await args.supabase
      .from('sleep_plan_profiles')
      .update({
        usual_wake_time: workingProfile.usualWakeTime,
        target_bedtime: workingProfile.targetBedtime,
        target_nap_count: workingProfile.targetNapCount,
        wake_window_profile: workingProfile.wakeWindowProfile,
        feed_anchor_profile: workingProfile.feedAnchorProfile,
        schedule_preference: workingProfile.schedulePreference,
        day_structure: workingProfile.dayStructure,
        adaptation_confidence: profileChangeEvent.evidenceConfidence,
        learning_state: workingProfile.learningState,
        last_evidence_summary: profileChangeEvent.summary,
      })
      .eq('id', workingProfile.id)
      .eq('baby_id', args.babyId)
      .select(SLEEP_PLAN_PROFILE_SELECT)
      .single()

    if (saveProfileError) {
      throw saveProfileError
    }

    savedProfile = normalizeSleepPlanProfileRow(savedProfileRow)
    if (!savedProfile) {
      throw new Error('Sleep plan profile save returned an empty payload')
    }

    const { error: profileEventError } = await args.supabase.from('sleep_plan_change_events').insert({
      baby_id: args.babyId,
      sleep_plan_profile_id: savedProfile.id,
      change_scope: 'profile',
      change_source: 'chat',
      change_kind: profileChangeEvent.changeKind,
      evidence_confidence: profileChangeEvent.evidenceConfidence,
      summary: profileChangeEvent.summary,
      rationale: profileChangeEvent.rationale,
      before_snapshot: profileChangeEvent.beforeSnapshot,
      after_snapshot: profileChangeEvent.afterSnapshot,
    })

    if (profileEventError) {
      throw profileEventError
    }
  }

  let savedPlan = args.currentPlan
  if (hasDailyToolChanges && workingPlan) {
    const dailyChangeEvent = buildDailyPlanChangeEvent({
      message: args.userMessage,
      beforePlan: args.currentPlan,
      afterPlan: workingPlan,
    })

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

    savedPlan = normalizeDailyPlanRow(savedPlanRow)
    if (!savedPlan) {
      throw new Error('Daily plan save returned an empty payload')
    }

    const { error: dailyEventError } = await args.supabase.from('sleep_plan_change_events').insert({
      baby_id: args.babyId,
      sleep_plan_profile_id: savedProfile?.id ?? args.currentProfile?.id ?? null,
      plan_date: args.planDate,
      change_scope: 'daily',
      change_source: 'chat',
      change_kind: dailyChangeEvent.changeKind,
      evidence_confidence: dailyChangeEvent.evidenceConfidence,
      summary: dailyChangeEvent.summary,
      rationale: dailyChangeEvent.rationale,
      before_snapshot: dailyChangeEvent.beforeSnapshot,
      after_snapshot: dailyChangeEvent.afterSnapshot,
    })

    if (dailyEventError) {
      throw dailyEventError
    }

    savedPlan = {
      ...savedPlan,
      metadata: {
        origin: 'saved_daily_plan',
        confidence: dailyChangeEvent.evidenceConfidence,
        reasonSummary: dailyChangeEvent.summary,
      },
    }
  }

  revalidatePath('/dashboard')

  const assistantMessage = buildChatPlanUpdateConfirmation({
    babyName: args.babyName,
    beforePlan: args.currentPlan,
    afterPlan: hasDailyToolChanges ? savedPlan : args.currentPlan,
    beforeProfile: args.currentProfile,
    afterProfile: hasProfileToolChanges ? savedProfile : args.currentProfile,
  })

  return {
    plan: savedPlan,
    profile: savedProfile,
    assistantMessage,
    streamPayload:
      hasDailyToolChanges && savedPlan
        ? {
            planDate: savedPlan.planDate,
            sleepTargets: savedPlan.sleepTargets,
            feedTargets: savedPlan.feedTargets,
            notes: savedPlan.notes,
            updatedAt: savedPlan.updatedAt,
            metadata: savedPlan.metadata,
          }
        : null,
  }
}

type PersistAiMemoryArgs = {
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
