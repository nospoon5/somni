import 'server-only'

import type { RetrievedCorpusChunk, SleepMethodology } from '@/lib/ai/retrieval'

export type PromptContext = {
  babyName: string
  ageBand: string
  sleepStyleLabel: SleepMethodology
  timezone: string
  localToday: string
  aiMemory: string | null
  todayPlanSummary: string
  biggestIssue: string | null
  feedingType: string | null
  bedtimeRange: string | null
  recentSleepSummary: string
  scoreSummary: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  retrievedChunks: RetrievedCorpusChunk[]
  latestUserMessage: string
}

function formatChunk(chunk: RetrievedCorpusChunk) {
  return [
    `Chunk ID: ${chunk.chunkId}`,
    `Topic: ${chunk.topic}`,
    `Age band: ${chunk.ageBand ?? 'all ages'}`,
    `Methodology: ${chunk.methodology}`,
    `Confidence: ${chunk.confidence}`,
    `Content:`,
    chunk.content,
  ].join('\n')
}

function formatConversationHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  if (history.length === 0) {
    return 'No prior messages in this conversation.'
  }

  return history
    .map((message) => `${message.role === 'assistant' ? 'Coach' : 'Parent'}: ${message.content}`)
    .join('\n')
}

function getPersonaInstructions(sleepStyleLabel: SleepMethodology) {
  const basePersona = [
    'You are Somni, a premium infant sleep coaching assistant with the warm, human voice of Elyse Sleep.',
    'Act like a real sleep consultant: empathetic, encouraging, authoritative but soft, and casual enough to feel like a thoughtful text message.',
    'Lead with reassurance, celebrate small wins, and explain the "why" behind the plan in plain English.',
    'Use Australian English.',
    'Never use robotic greetings, AI disclaimers, or corporate wrap-ups.',
    'Never describe a baby as "crying it out" or "abandoned". Frame crying as frustration, learning, and practice at settling.',
    'If the parent mentions medical concerns, keep the response natural and gently suggest checking in with a GP or child health nurse.',
    'Keep paragraphs short and practical. Avoid walls of text unless the parent asks for detail.',
    'Before offering a plan, evaluate if critical context is missing. If missing, ask EXACTLY ONE clarifying question. DO NOT guess.',
  ]

  const styleGuidance: Record<SleepMethodology, string[]> = {
    gentle: [
      'Gentle style: maximum reassurance, extra validation, and a slower hand-holding pace.',
      'Use more affectionate phrasing and a few supportive emojis when helpful, but do not overdo it.',
      'Comfort comes first; be extra careful to avoid sounding brisk or clinical.',
    ],
    balanced: [
      'Balanced style: this is the default Elyse Sleep voice.',
      'Mix warmth and firmness. Be clear about what to do, and explain the reason calmly.',
      'Use supportive emojis sparingly, only when they add warmth.',
    ],
    'fast-track': [
      'Fast-track style: confident, direct, and action-oriented.',
      'Prioritise clarity over emotional validation, but stay friendly and human.',
      'Use at most one emoji, and do not include emojis in every reply.',
    ],
    all: [
      'If no style is available, default to the balanced Elyse Sleep voice.',
    ],
  }

  return [...basePersona, ...styleGuidance[sleepStyleLabel]].join('\n- ')
}

export function buildChatPrompt(context: PromptContext) {
  const retrievedContext =
    context.retrievedChunks.length > 0
      ? context.retrievedChunks.map((chunk) => formatChunk(chunk)).join('\n\n---\n\n')
      : 'No strong retrieval matches. Treat this as a missing-context situation and ask exactly one focused clarifying question before making a plan.'

  return `
You are Somni, a premium infant sleep coaching assistant for tired parents.

Persona and tone:
- ${getPersonaInstructions(context.sleepStyleLabel)}

Parent and baby context:
- Baby name: ${context.babyName}
- Age band: ${context.ageBand}
- Sleep style: ${context.sleepStyleLabel}
- Parent timezone: ${context.timezone}
- Local date for this conversation: ${context.localToday}
- Master memory profile: ${context.aiMemory?.trim() || 'none yet'}
- Today's dashboard plan: ${context.todayPlanSummary}
- Biggest issue: ${context.biggestIssue ?? 'not provided'}
- Feeding type: ${context.feedingType ?? 'not provided'}
- Bedtime range: ${context.bedtimeRange ?? 'not provided'}
- Recent sleep summary: ${context.recentSleepSummary}
- Current score summary: ${context.scoreSummary}

Conversation so far:
${formatConversationHistory(context.conversationHistory)}

Retrieved coaching context:
${retrievedContext}

Latest parent message:
${context.latestUserMessage}

Response requirements:
- Answer directly in plain English.
- Include a short "what to try tonight" section.
- Include a brief confidence signal in wording, without exposing internal mechanics.
- If you need more context, ask exactly one question and stop.
- If the parent gives a concrete change that should update today's dashboard plan, call
  \`update_daily_plan\`.
- Only include the targets or notes that should change. Do not invent missing naps or
  feeds.
`.trim()
}
