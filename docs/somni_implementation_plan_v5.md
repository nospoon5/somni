# Somni Implementation Plan v5

## Purpose

This is the next execution plan for Somni after the Stage 11 to 14 AI and RAG uplift.

It is designed to be used one section at a time in separate Codex chats so each work stream
stays focused and the context window stays small.

## How To Use This Plan

Start a new chat for each numbered section below.

In each new chat:

1. Link the section name from this plan.
2. Ask Codex to complete the section end to end.
3. Require the quality gates to pass before the work is considered done.
4. Do not start the next section until the current section is genuinely complete.

## Recommended Execution Order

1. Foundation cleanup
   - Status: completed on 2026-04-14
2. Sleep score v2
   - Status: completed on 2026-04-14
3. AI quality hardening
   - Status: completed on 2026-04-14
4. Real-world constraint coaching
   - Status: next
5. Beta readiness

Sections 3 and 4 can overlap later, but only after Section 1 is complete.

## Section 1 - Foundation Cleanup

Status: completed on 2026-04-14

### Goal

Repair the small but trust-damaging issues that make the project feel less stable than it
really is.

### Why This Comes First

This section improves reliability, reduces confusion for future chats, and removes known
paper cuts before we do more advanced product work.

### Scope

- Fix the lint failure caused by legacy helper scripts
- Fix support-page context capture so reports include the real problem page
- Confirm the intended AI memory backfill schedule and align docs plus config
- Clean up any remaining drift in current docs
- Tighten project verification habits so future changes are easier to trust

### Detailed Steps

1. Fix lint reliability
   - Convert `scripts/cleanup_csv.js` and `scripts/debug_chat.js` to ESM, or move true scratch
     scripts out of normal lint scope.
   - Re-run lint until it is green.

2. Fix support page context capture
   - Decide how Somni should remember the page where a user hit a problem.
   - Prefer a simple, explicit flow such as storing the last in-app page or passing the origin
     page into the support form.
   - Keep the captured value readable in logs.

3. Resolve the AI memory backfill rule
   - Decide whether daily backfill is the intended behavior or whether the docs should say
     something else.
   - Align `vercel.json`, docs, and any comments in code.

4. Finish the docs cleanup
   - Make sure the current docs reflect the actual app.
   - Keep historical files in `archive/`.
   - Avoid duplicate source-of-truth statements.

5. Create a lightweight verification checklist
   - Document the minimum checks required after normal product changes.
   - Keep it short enough that people will actually run it.

### Quality Gates

- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes
- A support submission records the real originating page rather than always `/support`
- `vercel.json` schedule and docs agree
- Current docs have no obvious route or env-var drift

### Completed Work

- Converted legacy helper scripts to ESM:
  - `scripts/cleanup_csv.mjs`
  - `scripts/debug_chat.mjs`
- Added support-origin tracking and logging:
  - `src/components/support/SupportOriginTracker.tsx`
  - `src/app/layout.tsx`
  - `src/components/support/SupportForm.tsx`
  - `src/app/api/support/route.ts`
- Confirmed and aligned AI memory backfill timing in `vercel.json`
- Cleaned up current docs and added `docs/somni_verification_checklist.md`
- Verified:
  - `npm run lint`
  - `npm test -- --run`
  - `npm run build`

### Recommended Codex Setup

- Model: `5.3 Codex`
- Reasoning: `medium`

Why:

- This is mostly bounded cleanup and verification work.
- `5.3 Codex` should give strong code-edit quality without paying for heavier reasoning than we need.

## Section 2 - Sleep Score v2

Status: completed on 2026-04-14

### Goal

Make the sleep score feel fair, understandable, and trustworthy, especially for new users with
sparse data.

### Why This Matters

If the dashboard feels wrong early, parents will stop trusting the product before the stronger
parts of Somni can help them.

### Scope

- Fix sparse-data scoring behavior
- Revisit status labels and thresholds
- Improve score explanations in the UI
- Add stronger tests around edge cases

### Detailed Steps

1. Define the product rule for sparse data
   - Choose one clear policy:
     - insufficient-data state until a minimum sample exists, or
     - scoring over covered days instead of a fixed 7-day window
   - Pick the rule that will feel most honest to a new parent.

2. Update the scoring code
   - Implement the chosen sparse-data rule in `src/lib/scoring/sleep-score.ts`.
   - Make sure downstream summaries and labels still make sense.

3. Review labels and explanations
   - Confirm whether the current labels still match the product tone.
   - Make the explanation language feel supportive, not judgmental.

4. Add edge-case tests
   - zero logs
   - one or two logs only
   - mixed day and night data
   - age-band transitions
   - older babies with fragmented nights

5. Verify the dashboard behavior
   - Check the actual UI output for realistic early-user scenarios.

### Quality Gates

- Sparse-data users do not receive misleadingly poor scores
- Score outputs are deterministic for the tested edge cases
- Tests cover the new scoring policy
- `npm test -- --run` passes
- `npm run build` passes
- Score labels, helper text, and status logic all agree

### Completed Work

- Implemented a sparse-data policy in `src/lib/scoring/sleep-score.ts`
  - no-data state
  - learning / sparse-data state
  - ready-to-score state
- Switched scoring to a true recent 7-day window instead of the latest 7 sessions
- Updated status labels, helper text, and supportive explanation wording
- Added clarifying questions for sparse-data coaching follow-up
- Updated dashboard and chat consumers so UI and prompt logic agree
- Added edge-case and dashboard-state tests for:
  - zero logs
  - one or two logs
  - mixed day/night coverage
  - age-band transitions
  - fragmented older-baby nights
  - empty / learning / ready dashboard states
- Verified:
  - `npm test -- --run`
  - `npm run build`
  - `npm run lint`

### Recommended Codex Setup

- Model: `5.4`
- Reasoning: `high`

Why:

- This is product logic plus UX trust logic.
- The best result comes from stronger reasoning around edge cases and wording, not just code edits.

## Section 3 - AI Quality Hardening

Status: completed on 2026-04-14

### Goal

Push Somni's retrieval, prompt discipline, and evaluation workflow from "good first cut" to
"consistently dependable."

### Why This Matters

Stages 11 to 14 raised the overall quality a lot, but a few weak retrieval cases still show up,
especially around edge-case or vague queries.

### Scope

- Tighten weak retrieval scenarios
- Add better retrieval diagnostics
- Strengthen regression testing
- Protect against prompt and grounding regressions

### Detailed Steps

1. Build a focused weakness list
   - Start with the known misses and near-misses from the current evaluation.
   - Include at least:
     - early morning waking
     - daycare schedule constraints
     - toddler nap-transition edge cases
     - vague reset questions

2. Add retrieval observability
   - Capture enough debugging detail to answer:
     - which chunks were retrieved
     - what similarity scores they had
     - why the final answer used them
   - Keep it lightweight and safe for production logging.

3. Improve retrieval quality where needed
   - Tune ranking or fallback behavior only where the evidence shows a real problem.
   - Prefer targeted fixes over broad changes that could regress good cases.

4. Expand the regression pack
   - Turn the known weak scenarios into repeatable checks.
   - Make it easy to re-run after prompt or corpus changes.

5. Re-run comparison testing
   - Re-check that improvements help weak cases without harming tone, safety, or conciseness.

### Quality Gates

- Known weak scenarios show better retrieval relevance
- Retrieval diagnostics are available for debugging
- Evaluation scripts still run cleanly
- No regression in safety or citation behavior
- `npm run build` passes
- At least one targeted re-run shows net improvement on the chosen weakness set

### Completed Work

- Added a lightweight second-pass retrieval re-ranker in:
  - `src/lib/ai/retrieval-ranking.ts`
  - `src/lib/ai/retrieval.ts`
- Added retrieval diagnostics to the chat route in:
  - `src/app/api/chat/route.ts`
- Added focused weak-scenario coverage for:
  - early morning waking
  - daycare bedtime clashes
  - daycare drop-off nap constraints
  - toddler nap-transition edge cases
  - vague reset questions
- Added repeatable retrieval checks in:
  - `scripts/eval_data/retrieval_weakness_cases.json`
  - `scripts/verify-stage4-retrieval.mjs`
- Added focused ranking tests in:
  - `src/lib/ai/retrieval-ranking.test.ts`
- Updated end-to-end chat verification to confirm:
  - citations still appear
  - emergency redirects still fire
  - retrieval diagnostics are available in debug mode
- Documented the hardening work in:
  - `docs/somni_ai_quality_hardening.md`

### Verified Result

- Weakness-set comparison:
  - improved: 1
  - regressed: 0
  - unchanged: 4
- Most important retrieval fix:
  - the dedicated early-morning-waking chunk moved from rank 3 to rank 1 for the target case
- Verified:
  - `npm run lint`
  - `npm test -- --run`
  - `npm run build`
  - `node scripts/verify-stage4-retrieval.mjs`
  - `node scripts/verify-stage4-chat-e2e.mjs`

### Retrieval Inspection Notes

Use these before changing corpus content, prompt rules, or retrieval logic again:

1. Run the focused weakness set:
   - `node scripts/verify-stage4-retrieval.mjs`
2. If you need server-side retrieval logs:
   - set `SOMNI_LOG_RETRIEVAL=true`
3. If you need retrieval diagnostics returned by `/api/chat`:
   - set `SOMNI_INCLUDE_RETRIEVAL_DEBUG=true`
4. Read:
   - `docs/somni_ai_quality_hardening.md`

### Recommended Codex Setup

- Model: `5.4`
- Reasoning: `high`

Why:

- This section mixes product reasoning, prompt design, retrieval tuning, and evaluation design.
- It benefits from stronger reasoning more than from raw code speed.

## Section 4 - Real-World Constraint Coaching

### Goal

Make Somni much better at answering "what do I do when real life gets in the way?" questions.

### Why This Matters

This is one of the clearest product-differentiation opportunities. Parents do not live in ideal
sleep textbook conditions.

### Scope

- Daycare and fixed drop-off schedules
- Travel and porta-cot disruption
- Illness recovery and teething disruption
- Caregiver handoff and split-routine scenarios
- "What do I do tonight?" compression for tired parents

### Detailed Steps

1. Define the scenario set
   - Create a short list of high-frequency, high-stress real-world scenarios.
   - Rank them by user value and current Somni weakness.

2. Audit current coverage
   - Check corpus, prompt behavior, and daily-plan behavior for each scenario.
   - Note whether the problem is missing content, weak retrieval, weak phrasing, or missing UI support.
   - Before changing anything, inspect current retrieval for the chosen scenarios using:
     - `node scripts/verify-stage4-retrieval.mjs`
     - `docs/somni_ai_quality_hardening.md`
   - If a scenario already retrieves the right chunk, prefer prompt or product fixes over broad retrieval changes.

3. Fill the gaps
   - Add or revise chunks where the corpus is thin.
   - Improve prompt guidance where Somni should make tradeoffs more explicitly.
   - Improve daily-plan update behavior where practical.

4. Add scenario evaluations
   - Write scenario-based tests that check usefulness, realism, and clarity.
   - Make sure answers do not drift back into generic sleep advice.

5. Verify parent usefulness
   - For each scenario, confirm the answer includes:
     - what is happening
     - what to do tonight or today
     - what compromise is acceptable
     - when to review the plan again

### Quality Gates

- Each chosen scenario has clear corpus and response coverage
- Answers include practical tradeoffs, not just ideal advice
- Daily-plan updates remain coherent when scenario changes affect today's plan
- Retrieval and response checks for the chosen scenarios pass
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.4`
- Reasoning: `high`

Why:

- This is concept-heavy and user-experience-heavy.
- The higher-quality model is worth it because the value comes from judgment and product empathy.

## Section 5 - Beta Readiness

### Goal

Prepare Somni for a broader round of real users without making the app feel fragile behind the
scenes.

### Why This Matters

By this point the product should be strong enough that operational reliability becomes the main
risk.

### Scope

- Basic smoke-test coverage for critical flows
- Better support and incident triage habits
- Better deployment confidence
- Clearer release checklist

### Detailed Steps

1. Define the must-not-break flows
   - sign up and sign in
   - onboarding
   - sleep logging
   - dashboard load
   - chat send and response
   - billing upgrade flow
   - support form

2. Add smoke-test coverage
   - Prefer a short, reliable suite over a long brittle suite.
   - Cover the flows that would embarrass the product if they broke silently.

3. Improve runtime support workflow
   - Decide whether runtime logs are still enough or whether support needs a proper inbox next.
   - Document where to look first when a user reports a problem.

4. Improve release hygiene
   - Write a short pre-release checklist.
   - Include env checks, build checks, and critical flow checks.

5. Add basic monitoring expectations
   - Define what should be watched in production:
     - build failures
     - API errors
     - chat failures
     - billing webhook failures
     - support request volume

### Quality Gates

- Critical-path smoke tests pass
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes
- There is a documented place to check when support issues arrive
- A short release checklist exists and is usable

### Recommended Codex Setup

- Model: `5.3 Codex`
- Reasoning: `medium`

Why:

- This is mostly implementation and verification work.
- It needs discipline more than deep conceptual reasoning.

## Model Selection Summary

If you want the shortest practical rule set:

- Use `5.3 Codex` + `medium` for cleanup, implementation, and verification-heavy tasks.
- Use `5.4` + `high` for scoring logic, AI quality, and product-judgment work.
- Use `5.4 Mini` only for small, tightly scoped follow-ups where cost matters more than depth.
- Skip `extra high` unless the task is unusually ambiguous or a section is getting stuck.
