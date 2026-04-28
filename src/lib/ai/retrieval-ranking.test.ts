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

  it('promotes safe sleep guidance for bouncer sleep questions', () => {
    const result = rerankRetrievedChunks({
      query: "Is it okay if my 2-month-old sleeps in his bouncer sometimes during the day?",
      ageBand: '0-3 months',
      methodology: 'balanced',
      strategy: 'rpc',
      limit: 3,
      candidates: [
        makeCandidate({
          chunkId: '0-3m-nap-schedules-wake-windows',
          topic: 'Nap schedules and wake windows',
          content: 'Most 2-month-old babies need short wake windows and several naps.',
          similarity: 0.83,
        }),
        makeCandidate({
          chunkId: 'all-ages-safe-sleeping',
          topic: 'safe sleeping',
          content:
            'Babies should sleep on a firm flat sleep surface. Bouncers, swings and inclined devices are not safe for sleep because of suffocation risk.',
          similarity: 0.7,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('all-ages-safe-sleeping')
  })

  it('promotes rolling and swaddle safety guidance', () => {
    const result = rerankRetrievedChunks({
      query: 'We want to swaddle our 3-month-old but he recently started rolling. Is it still safe?',
      ageBand: '0-3 months',
      methodology: 'balanced',
      strategy: 'rpc',
      limit: 3,
      candidates: [
        makeCandidate({
          chunkId: '0-3m-nap-schedules-wake-windows',
          topic: 'Nap schedules and wake windows',
          content: 'Wake windows at this age are usually short.',
          similarity: 0.82,
        }),
        makeCandidate({
          chunkId: 'all-ages-rolling-swaddle-safety',
          topic: 'rolling and swaddle safety',
          content:
            'Once a baby shows signs of rolling, swaddling is no longer safe. Move to arms-free sleep.',
          similarity: 0.72,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('all-ages-rolling-swaddle-safety')
  })

  it('promotes urgent medical guidance for fever and lethargy', () => {
    const result = rerankRetrievedChunks({
      query:
        'My 5-month-old has had a fever of 39.5C for two days and is very lethargic, passing out instantly.',
      ageBand: '4-6 months',
      methodology: 'fast-track',
      strategy: 'rpc',
      limit: 3,
      candidates: [
        makeCandidate({
          chunkId: '4-6m-split-night',
          topic: 'split night waking in babies',
          content: 'A split night is a long awake period overnight.',
          similarity: 0.84,
        }),
        makeCandidate({
          chunkId: 'all-ages-urgent-illness',
          topic: 'urgent illness and medical care',
          content:
            'Fever with lethargy, floppy behaviour, or passing out needs urgent medical advice or emergency care.',
          similarity: 0.68,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('all-ages-urgent-illness')
  })

  it('force-includes medication boundary guidance even when similarity is lower', () => {
    const result = rerankRetrievedChunks({
      query: 'Can I give my 6-month-old melatonin gummies for sleep?',
      ageBand: '4-6 months',
      methodology: 'balanced',
      strategy: 'rpc',
      limit: 2,
      candidates: [
        makeCandidate({
          chunkId: '4-6m-sleep-regression',
          topic: 'Sleep regression',
          content: 'The 4-month regression can cause frequent waking.',
          similarity: 0.85,
        }),
        makeCandidate({
          chunkId: '4-6m-nap-schedules',
          topic: 'Nap schedules and wake windows',
          content: 'Nap timing can affect bedtime.',
          similarity: 0.82,
        }),
        makeCandidate({
          chunkId: 'all-ages-medication-supplement-boundary',
          topic: 'medication and supplement boundary',
          content:
            'Melatonin and sleep supplements should be discussed with a GP or child health nurse before use.',
          similarity: 0.55,
        }),
      ],
    })

    expect(result.selected[0]?.chunkId).toBe('all-ages-medication-supplement-boundary')
  })
})
