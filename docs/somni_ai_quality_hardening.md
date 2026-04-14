# Somni AI Quality Hardening

This note records the Section 3 hardening work for retrieval quality, debugging, and
repeatable checks.

## Focused Weakness List

These were the priority scenarios for retrieval hardening:

- early morning waking before 6am
- daycare bedtime clashes after long childcare naps
- daycare drop-off constraints that block the first nap
- toddler 2-to-1 nap-transition edge cases
- vague "sleep is bad, fix it" reset questions

Why these were chosen:

- They were either known weak or near-miss cases in the current evaluation set.
- The corpus already had good content for them, which meant ranking and inspection were the
  safer fixes than broad prompt changes.

## What Changed

- Retrieval now does a small second-pass re-rank on the top candidates instead of trusting
  pure vector similarity alone.
- The second pass adds narrow boosts when the query clearly signals:
  - early waking
  - daycare or work constraints
  - nap transitions
  - vague reset-plan wording
- The chat route now supports retrieval diagnostics for debugging and evaluation.

## Retrieval Diagnostics

Diagnostics include:

- query preview
- retrieval path (`rpc`, `fallback`, or `empty`)
- detected intent signals
- selected chunk count
- candidate chunk IDs and topics
- original retrieval score
- re-rank boost
- final score
- short plain-English reasons for why a chunk was promoted

### How to turn diagnostics on

For server-side logging only:

- set `SOMNI_LOG_RETRIEVAL=true`

To include diagnostics in the `/api/chat` SSE `done` payload:

- set `SOMNI_INCLUDE_RETRIEVAL_DEBUG=true`, or
- send the request in eval mode, or
- use `?retrieval_debug=1` on the chat endpoint

This keeps normal parent-facing responses unchanged while still making debugging possible.

## Regression Checks

The weak-scenario regression pack now lives in:

- `scripts/eval_data/retrieval_weakness_cases.json`

Run the targeted retrieval check with:

```bash
node scripts/verify-stage4-retrieval.mjs
```

What it now does:

- runs the weakness set
- compares legacy ranking vs hardened ranking
- fails if expected chunks no longer land inside the required top ranks
- fails if the weakness set shows no net improvement

For end-to-end chat verification, including citations, emergency handling, and retrieval
debug payloads:

```bash
node scripts/verify-stage4-chat-e2e.mjs
```

## Latest Targeted Rerun Result

The weakness-set rerun showed:

- improved: 1
- regressed: 0
- unchanged: 4

Most important win:

- the early-morning-waking case moved from rank 3 to rank 1 for the dedicated early-waking
  chunk
