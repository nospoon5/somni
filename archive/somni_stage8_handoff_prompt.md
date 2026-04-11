# Somni - Stage 8 Handoff Prompt for CODEX

Use the following prompt to start a fresh CODEX session focused on Stage 8.

---

You are stepping in as lead engineer for the Somni project (premium Next.js infant sleep coaching app).

Your only mission in this session is to execute **Stage 8: AI Persona & Corpus Enrichment** from the V3 implementation plan.

## Mandatory workflow

1. Read `docs/somni_implementation_plan_v3.md` in full before writing code.
2. Execute **only Stage 8** tasks. Do not start Stage 9 or Stage 10.
3. Work strictly in sequence and keep context tight.
4. Complete and verify all Stage 8 Quality Control Gates before asking to close the stage.
5. Keep explanations in plain English suitable for a non-technical founder.

## Stage context you must assume is already done

- Stage 7 is **partially complete**:
  - Option A (SVG logo conversion): deferred intentionally.
  - Option B complete: DB constraint added so each baby can have only one active sleep session (`ended_at IS NULL`).
  - Option C complete: `/chat` now degrades gracefully (read-only mode) when billing setup/fetch fails.
- Relevant Stage 7 files changed:
  - `src/app/chat/page.tsx`
  - `src/components/chat/ChatCoach.tsx`
  - `src/components/chat/ChatCoach.module.css`
  - `supabase/migrations/20260406_sleep_logs_single_active_session.sql`
- Migration housekeeping already done:
  - `supabase/migrations/20260404_add_corpus_match_function.sql` exists (renamed from duplicate version id).

## Stage 8 tasks to execute

From `docs/somni_implementation_plan_v3.md`:

1. Add corpus chunk file: `corpus/chunks/10_minute_wait_and_assess.md`
2. Add corpus chunk file: `corpus/chunks/avoiding_micro_naps.md`
3. Use finalized persona doc `docs/somni_ai_persona.md`
4. Inject persona tone into `src/lib/ai/prompt.ts` with conditional behavior by `sleepStyleLabel` (`gentle`, `balanced`, `fast-track`)
5. Add guardrail to prompt:
   - Before offering a plan, if critical context is missing, ask exactly one clarifying question and do not guess.

## Stage 8 quality gates to prove

1. Both new markdown chunks are uploaded and embedded into Supabase `corpus_chunks` (via uploader script).
2. For missing-context input like “My baby woke up early”, assistant asks one focused follow-up question (not hallucinated plan).
3. Chat outputs clearly reflect warm, empathetic persona tone.

## Output required at end of session

1. Stage 8 completion summary in checklist format:
   - Tasks completed
   - QC gates pass/fail with evidence
2. Exact files changed
3. Commands run and notable outputs
4. Any risks, assumptions, or follow-up suggestions

---
