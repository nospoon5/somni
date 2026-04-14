import { describe, expect, it } from 'vitest'

import { rerankRetrievedChunks } from './retrieval-ranking'

function makeCandidate(args: {
  chunkId: string
  topic: string
  content: string
  similarity: number
  ageBand?: string | null
  methodology?: string
}) {
  return {
    id: args.chunkId,
    chunkId: args.chunkId,
    topic: args.topic,
    ageBand: args.ageBand ?? null,
    methodology: args.methodology ?? 'balanced',
    content: args.content,
    sources: [],
    confidence: 'high' as const,
    similarity: args.similarity,
  }
}

describe('rerankRetrievedChunks', () => {
  it('promotes the early waking chunk for 5am wake-up queries', () => {
    const result = rerankRetrievedChunks({
      query: 'She keeps waking up at 5:00 AM bright and ready to start the day. How do I shift that?',
      ageBand: '4-6 months',
      methodology: 'fast-track',
      strategy: 'rpc',
      limit: 3,
      candidates: [
        makeCandidate({
          chunkId: '4-6m-split-night',
          topic: 'split night waking in babies',
          content: 'A split night is when a baby is awake and playful at 2am for one to three hours.',
          similarity: 0.8,
        }),
        makeCandidate({
          chunkId: 'all-ages-early-morning-waking',
          topic: 'Early morning waking (before 6am)',
          content:
            'Early morning waking before 6am is often driven by light, temperature, and reinforcing the day too early.',
          similarity: 0.74,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('all-ages-early-morning-waking')
    expect(result.diagnostics.candidates[0]?.reasons.some((reason) => reason.label.includes('early morning'))).toBe(true)
  })

  it('promotes daycare-constraint guidance when drop-offs block the morning nap', () => {
    const result = rerankRetrievedChunks({
      query:
        "I can't do the morning nap anymore because of daycare drop-offs. Please push his first nap to 11:30am every day.",
      ageBand: '6-12 months',
      methodology: 'balanced',
      strategy: 'rpc',
      limit: 3,
      candidates: [
        makeCandidate({
          chunkId: '6-12m-self-settling-techniques',
          topic: 'Self-settling techniques',
          content: 'Use a calm bedtime routine and pause before responding overnight.',
          similarity: 0.78,
        }),
        makeCandidate({
          chunkId: 'all-ages-schedule-constraints-daycare-work',
          topic: 'sleep plans under daycare and work constraints',
          content:
            'Daycare drop-offs, work starts, and school runs can block the ideal nap. Use a bridge nap instead of forcing a giant wake window.',
          similarity: 0.73,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('all-ages-schedule-constraints-daycare-work')
  })

  it('keeps nap-transition chunks ahead of generic toddler advice for one-nap questions', () => {
    const result = rerankRetrievedChunks({
      query: 'Do toddlers need a morning nap at 13 months, or should they all be on one nap by this age?',
      ageBand: '12 months+',
      methodology: 'fast-track',
      strategy: 'rpc',
      limit: 3,
      candidates: [
        makeCandidate({
          chunkId: '12m-plus-toddler-bedtime-stalling',
          topic: 'toddler bedtime stalling and room-leaving',
          content: 'A toddler who leaves the room needs calm, consistent bedtime boundaries.',
          similarity: 0.79,
        }),
        makeCandidate({
          chunkId: '12m-plus-nap-transitions',
          topic: 'Nap transitions after 12 months (2 to 1 readiness and bridging)',
          content:
            'At 13 months, many toddlers are moving toward one nap, but they are not all ready on exactly the same timeline.',
          similarity: 0.76,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('12m-plus-nap-transitions')
  })

  it('keeps vague reset questions tied to reset-plan chunks', () => {
    const result = rerankRetrievedChunks({
      query: 'Sleep is bad. Fix it.',
      ageBand: '6-12 months',
      methodology: 'balanced',
      strategy: 'rpc',
      limit: 3,
      candidates: [
        makeCandidate({
          chunkId: '6-12m-feeding-sleep-relationship-night-weaning',
          topic: 'Feeding and sleep relationship (night weaning)',
          content: 'Night feeds can be reduced gradually when the baby is ready.',
          similarity: 0.76,
        }),
        makeCandidate({
          chunkId: '6-12m-independent-settling-common-mistakes',
          topic: 'independent settling mistakes and reset plan',
          content:
            'When sleep feels messy, start with one target, one settling response, and a simple reset plan.',
          similarity: 0.74,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('6-12m-independent-settling-common-mistakes')
  })
})
