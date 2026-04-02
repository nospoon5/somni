import 'server-only'

import type { RetrievedCorpusChunk, SleepMethodology } from '@/lib/ai/retrieval'

export type PromptContext = {
  babyName: string
  ageBand: string
  sleepStyleLabel: SleepMethodology
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

export function buildChatPrompt(context: PromptContext) {
  const retrievedContext =
    context.retrievedChunks.length > 0
      ? context.retrievedChunks.map((chunk) => formatChunk(chunk)).join('\n\n---\n\n')
      : 'No strong retrieval matches. Use conservative general guidance and lower confidence.'

  return `
You are Somni, a premium infant sleep coaching assistant for tired parents.

Rules you must follow:
- Use Australian English.
- Use a calm, non-judgmental tone.
- Keep advice practical and one-handed friendly.
- Never invent medical facts.
- If uncertain, say that clearly and keep guidance conservative.
- Always prioritise safe-sleep guidance.
- Do not claim certainty beyond provided context.

Parent and baby context:
- Baby name: ${context.babyName}
- Age band: ${context.ageBand}
- Sleep style: ${context.sleepStyleLabel}
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
`.trim()
}
