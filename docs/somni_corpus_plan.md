# Somni - Corpus Plan

## Goal

The corpus is the trusted sleep-knowledge layer behind Somni's AI coach.

The rule is simple:

**Better corpus quality beats bigger model quality.**

## Current State (2026-04-12)

- Corpus chunks live in `corpus/chunks/`
- Source notes live in `corpus/sources/`
- Source tracking lives in `corpus/metadata/source_index.md`
- The latest corpus upload produced `57` chunks in `public.corpus_chunks`
- Retrieval currently asks for up to `7` chunks
- Retrieval filters out matches below similarity `0.3`

## Source Standard

Primary preference is Australian guidance:

- Red Nose Australia
- Tresillian
- Karitane
- Raising Children Network
- RCH Melbourne
- Australian Breastfeeding Association
- Relevant Australian health sources

Rules:

- Prefer Australian sources when they cover the topic well.
- Use international sources only when there is a clear reason.
- Replace weak or outdated sources when a better Australian equivalent exists.
- Paraphrase source material. Do not copy it word-for-word.

## What a Good Chunk Must Do

A chunk should:

- answer a real parent question
- stay tightly focused on one topic
- be clear enough to quote naturally in chat
- include actionable guidance
- stay safe and non-medical
- include usable metadata for retrieval

## Chunk Metadata

Each chunk should include:

- `topic`
- `age_band`
- `methodology`
- `sources`
- `confidence`

Recommended supporting metadata when needed:

- stable `chunk_id`
- update date
- tags for evaluation or maintenance scripts

## Chunk Writing Rules

- Plain, calm, practical language
- No verbatim copying
- No generic filler
- No unsupported claims
- No medical diagnosis language
- Include "what to try" style guidance when the topic calls for action
- Keep safety-critical points easy to surface in retrieval

## Retrieval Guidance

- Age band is a relevance hint, not a hard block
- Methodology is a relevance hint, not a hard block
- Safety guidance must still surface across methodology boundaries
- Chunks should be specific enough that edge-case queries can hit an obvious target

## Coverage Priorities

The corpus should stay strong in:

- wake windows and nap schedules
- settling methods across sleep styles
- frequent waking and early morning waking
- nap transitions
- safe sleep
- feeding and sleep relationships
- illness, teething, and regressions
- real-life constraint topics such as daycare, travel, room-sharing, and caregiver handoff

## Current Quality Risks

- Some edge-case topics still retrieve "nearby" chunks instead of the best chunk
- A few historical files and source-index formatting issues still need cleanup
- Real-world constraint coaching needs broader scenario coverage

## Working Rule

Whenever we add or revise corpus content:

1. Confirm the parent scenario we are trying to answer.
2. Confirm the strongest source set.
3. Write or revise the chunk.
4. Re-upload or refresh the corpus.
5. Re-run retrieval checks on the target scenarios.
