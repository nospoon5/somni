import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { extractUpdatedAiMemory } from '@/lib/ai/memory'

type BackfillResult = {
  scannedBabies: number
  updatedBabies: number
  skippedBabies: number
  failedBabies: number
}

type LatestMessage = {
  conversation_id: string
}

type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

function getPositiveInteger(value: string | undefined, fallbackValue: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue
  }
  return Math.floor(parsed)
}

export async function runAiMemoryBackfill(): Promise<BackfillResult> {
  const supabase = createAdminClient()
  const babyLimit = getPositiveInteger(process.env.AI_MEMORY_BACKFILL_BABY_LIMIT, 50)
  const messageLimit = getPositiveInteger(process.env.AI_MEMORY_BACKFILL_MESSAGE_LIMIT, 8)

  const { data: babies, error: babiesError } = await supabase
    .from('babies')
    .select('id, profile_id, name, ai_memory')
    .order('created_at', { ascending: false })
    .limit(babyLimit)

  if (babiesError) {
    throw new Error(`Failed to load babies for backfill: ${babiesError.message}`)
  }

  let updatedBabies = 0
  let skippedBabies = 0
  let failedBabies = 0

  for (const baby of babies ?? []) {
    try {
      const { data: latestMessage, error: latestMessageError } = await supabase
        .from('messages')
        .select('conversation_id')
        .eq('profile_id', baby.profile_id)
        .eq('baby_id', baby.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<LatestMessage>()

      if (latestMessageError) {
        throw new Error(`Failed to load latest message: ${latestMessageError.message}`)
      }

      if (!latestMessage?.conversation_id) {
        skippedBabies += 1
        continue
      }

      const { data: conversationMessages, error: conversationError } = await supabase
        .from('messages')
        .select('role, content')
        .eq('profile_id', baby.profile_id)
        .eq('baby_id', baby.id)
        .eq('conversation_id', latestMessage.conversation_id)
        .order('created_at', { ascending: false })
        .limit(messageLimit)

      if (conversationError) {
        throw new Error(`Failed to load conversation messages: ${conversationError.message}`)
      }

      const typedMessages = (conversationMessages ?? []) as ConversationMessage[]
      const latestUserMessage = typedMessages.find((item) => item.role === 'user')?.content
      const latestAssistantMessage = typedMessages.find(
        (item) => item.role === 'assistant'
      )?.content

      if (!latestUserMessage || !latestAssistantMessage) {
        skippedBabies += 1
        continue
      }

      const updatedMemory = await extractUpdatedAiMemory({
        babyName: baby.name,
        existingMemory: baby.ai_memory,
        latestUserMessage,
        latestAssistantMessage,
      })

      if (!updatedMemory) {
        skippedBabies += 1
        continue
      }

      const { error: updateError } = await supabase
        .from('babies')
        .update({ ai_memory: updatedMemory })
        .eq('id', baby.id)
        .eq('profile_id', baby.profile_id)

      if (updateError) {
        throw new Error(`Failed to update ai_memory: ${updateError.message}`)
      }

      updatedBabies += 1
    } catch (error) {
      failedBabies += 1
      console.error('[memory-backfill] baby failed', {
        babyId: baby.id,
        profileId: baby.profile_id,
        error,
      })
    }
  }

  return {
    scannedBabies: babies?.length ?? 0,
    updatedBabies,
    skippedBabies,
    failedBabies,
  }
}
