# Somni Implementation Plan v7

## Purpose

This plan defines the next major product build for Somni:

**one recommended starting sleep plan that is personalised on day one, then adapted over time from trustworthy evidence.**

The feature must respect the product decisions already locked in:

- one recommended starting plan, not a gallery of schedule choices
- age drives sleep biology
- parenting style changes how assertive and structured the plan feels, not the baby's basic sleep needs
- sleep comes first, with light feed anchors where helpful
- Somni can adapt the plan automatically, but missing logs must never be treated as proof that a sleep did not happen
- explicit parent statements carry more weight than sparse or partial logs
- daily rescue changes and durable baseline shifts are different things

## Implementation Principles

1. Keep schedule and adaptation rules in code, not in free-form prompts.
2. Separate the durable learned sleep profile from today's editable plan.
3. Use the AI to explain, classify, and apply well-bounded changes - not to invent the whole schedule from scratch.
4. Auto-changes must be explainable to the parent in plain English.
5. Sparse logging should reduce confidence, not create false conclusions.
6. Age-appropriate guardrails must block aggressive changes that are not yet developmentally sensible.

## How To Use This Plan

Start a new Codex chat for each stage below.

In each new chat:

1. Link this file and the stage name you want completed.
2. Read the relevant source files listed in that stage before touching code.
3. Run the required quality gates before and after the stage.
4. Update docs in the same work stream if the code changes the source of truth.
5. Do not start the next stage until the current one is genuinely complete.

## Pre-Flight Check (Before Starting Any Stage)

Run these from project root before editing:

```bash
npm run lint
npm test -- --run
npm run build
```

If the stage touches chat, retrieval, or prompt logic, also run:

```bash
node scripts/verify-stage4-retrieval.mjs
```

## Test Credentials

See `docs/TEST_ACCOUNTS.md`.
Do not sign up a new user.
Always use the pre-created test account.

## Architecture Target

By the end of v7, Somni should use this mental model:

- `sleep_plan_profiles`
  - the durable learned profile for that baby
  - holds the current best guess of usual wake time, bedtime target, nap count, wake window pattern, flexibility, and adaptation confidence
- `daily_plans`
  - today's practical plan only
  - may be derived from the profile or explicitly adjusted for today
- `sleep_plan_change_events`
  - audit trail of why Somni changed something
  - stores change scope, source, confidence, and short rationale

The key product rule is:

**Somni should only make a durable baseline shift when the evidence is strong enough.**

Evidence priority:

1. explicit parent statement in chat
2. repeated pattern across reasonably covered logs
3. low-confidence hints from sparse logs

Expected adaptation behavior:

- same-day rescue change:
  - earlier bedtime after a rough nap day
  - adjust today's catnap or feed anchor
- durable baseline change:
  - wake time is consistently 6:00 am, not 7:00 am
  - three naps are no longer realistic and age plus pattern support the transition

---

## Stage 1 - Adaptive Plan Data Model And Guardrails

### Goal

Create the durable domain model for learned plans before changing onboarding or UI behavior.

### Why This Comes First

If Somni does not distinguish between a learned baseline and today's temporary plan, later stages will become messy and hard to trust.

### Scope

- Add a durable `sleep_plan_profiles` table
- Add a `sleep_plan_change_events` table for explainability and audit history
- Add typed helpers for reading, validating, and normalising these records
- Add the first code-level enums and guardrails for:
  - change scope
  - change source
  - evidence confidence
  - learning state
- Update current architecture docs so future chats follow the same model

### Recommended Data Shape

`sleep_plan_profiles`

- `id`
- `baby_id` (unique)
- `age_band`
- `template_key`
- `usual_wake_time`
- `target_bedtime`
- `target_nap_count`
- `wake_window_profile` (jsonb)
- `feed_anchor_profile` (jsonb)
- `schedule_preference`
- `day_structure`
- `adaptation_confidence`
- `learning_state`
- `last_auto_adjusted_at`
- `last_evidence_summary`
- `created_at`
- `updated_at`

`sleep_plan_change_events`

- `id`
- `baby_id`
- `sleep_plan_profile_id`
- `plan_date` (nullable for profile-only changes)
- `change_scope` (`profile` or `daily`)
- `change_source` (`onboarding`, `chat`, `logs`, `system`)
- `change_kind` (`bootstrap`, `daily_rescue`, `baseline_shift`, `manual_correction`)
- `evidence_confidence` (`low`, `medium`, `high`)
- `summary`
- `rationale`
- `before_snapshot` (jsonb)
- `after_snapshot` (jsonb)
- `created_at`

### Relevant Files

- `docs/somni_architecture.md`
- `docs/somni_context.md`
- `supabase/migrations/20260402_init_schema.sql`
- `supabase/migrations/202604071200_add_daily_plans.sql`
- `src/lib/daily-plan.ts`

### Detailed Steps

1. Add a Supabase migration for `sleep_plan_profiles` with RLS policies consistent with the rest of the baby-owned tables.
2. Add a Supabase migration for `sleep_plan_change_events` with baby ownership checks and readable audit history.
3. Create a new helper module such as `src/lib/sleep-plan-profile.ts` for:
   - row normalisation
   - typed enums
   - snapshot helpers
   - confidence helpers
4. Add unit tests for the new helper layer.
5. Update `docs/somni_architecture.md` so the new tables and plan flow are part of the source of truth.
6. Do not change onboarding or dashboard behavior yet. This stage is foundation only.

### Quality Gates

- Migration applies cleanly and uses RLS
- One profile per baby is enforced
- Change events can be inserted and selected correctly for the owning user
- New helper module has focused tests
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.4`
- Reasoning: `medium`

Why:

- This is high-leverage architecture work.
- It needs clean product judgment, but not the heaviest reasoning tier.

### Prompt For A New Chat

```text
Read these first:
- docs/somni_implementation_plan_v7.md (Stage 1 only)
- docs/somni_context.md
- docs/somni_architecture.md
- supabase/migrations/20260402_init_schema.sql
- supabase/migrations/202604071200_add_daily_plans.sql
- src/lib/daily-plan.ts

Task:
Complete Stage 1 of docs/somni_implementation_plan_v7.md end to end.

Requirements:
- Add the durable adaptive-plan schema and helper layer exactly within the spirit of Stage 1.
- Keep product logic in code, not prompts.
- Match Somni's existing schema and RLS patterns.
- Do not implement onboarding or UI behavior yet.
- Update docs if the architecture source of truth changes.

Quality gates:
- npm run lint
- npm test -- --run
- npm run build

At the end:
- Summarize what changed
- Call out any schema decisions made
- Mention anything intentionally deferred to later stages
```

---

## Stage 2 - Onboarding Expansion And Initial Recommended Plan

### Goal

Capture the missing onboarding inputs that make the first plan feel personal, then generate one recommended starting profile for each baby.

### Why This Matters

The first plan must feel relevant on day one. If Somni starts too generic, trust drops before the adaptation logic has a chance to help.

### Scope

- Add the missing onboarding questions
- Save the answers cleanly
- Generate the first `sleep_plan_profile`
- Keep the plan sleep-first with light feed anchors
- Make parenting style affect structure and flexibility, not age biology
- Add a bootstrap path for existing users who onboarded before the new questions existed

### New Onboarding Inputs

Add practical questions only:

- typical morning wake time
- day structure (`mostly home/flexible`, `daycare`, `work-constrained`, or similar)
- current nap pattern most days
- whether night feeds are still happening
- preferred schedule feel (`more flexible`, `mix of cues and anchors`, `more clock-based`)

### Relevant Files

- `src/components/onboarding/OnboardingForm.tsx`
- `src/app/onboarding/actions.ts`
- `src/lib/baseline-plans/index.ts`
- `src/lib/baseline-plans/templates/*`
- new helper(s) under `src/lib/sleep-plan-profile/` or similar
- relevant Supabase migration files

### Detailed Steps

1. Add the new onboarding fields in plain-English language that suits a non-technical tired parent.
2. Save the new answers in a durable place. Prefer extending `onboarding_preferences` unless there is a strong reason not to.
3. Build `createInitialSleepPlanProfile(...)` using:
   - baby age
   - sleep style label
   - wake time
   - day structure
   - nap pattern
   - night feeds
   - schedule preference
4. Keep one hidden schedule library internally. Do not present multiple user-facing schedule options.
5. Make age determine nap count range and sleep totals.
6. Make sleep style change:
   - how tight the anchors are
   - how broad the acceptable windows are
   - how quickly later stages are allowed to adapt
7. Keep feed anchors light and supportive, not heavy-handed.
8. Add a bootstrap path for old users with missing answers:
   - create a sensible starting profile from age plus existing onboarding data
   - leave confidence lower when data is missing
9. Add focused tests for initial profile generation.

### Quality Gates

- New onboarding fields save correctly
- A new user gets one recommended plan profile immediately after onboarding
- Two babies of the same age but different wake times get different starting anchors
- Two babies of the same age but different sleep styles get different plan strictness, not different age biology
- Existing users without the new answers still get a safe bootstrap profile
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.4`
- Reasoning: `high`

Why:

- This stage mixes product logic, onboarding UX, and schedule-personalisation rules.
- It is worth paying for stronger reasoning here.

### Prompt For A New Chat

```text
Read these first:
- docs/somni_implementation_plan_v7.md (Stage 2 only)
- docs/somni_context.md
- docs/somni_architecture.md
- docs/somni_verification_checklist.md
- src/components/onboarding/OnboardingForm.tsx
- src/app/onboarding/actions.ts
- src/lib/baseline-plans/index.ts
- src/lib/baseline-plans/templates/*
- any Stage 1 files added for adaptive plan profiles

Task:
Complete Stage 2 of docs/somni_implementation_plan_v7.md end to end.

Requirements:
- Add the new onboarding questions in plain English.
- Generate one recommended starting plan profile, not multiple user-facing options.
- Age must drive sleep biology.
- Sleep style should affect flexibility and assertiveness, not basic developmental needs.
- Add a safe bootstrap path for existing users with older onboarding data.
- Update docs if source-of-truth behavior changes.

Quality gates:
- npm run lint
- npm test -- --run
- npm run build

At the end:
- Summarize the new onboarding fields
- Explain how the initial profile is generated
- Note any bootstrap assumptions for older users
```

---

## Stage 3 - Daily Plan Derivation Engine

### Goal

Generate today's plan from the durable profile instead of falling back to a generic age-only baseline.

### Why This Matters

Once Somni knows the baby's likely wake time and structure, the dashboard should reflect that even before the parent chats.

### Scope

- Replace the age-only fallback with a profile-driven daily plan builder
- Keep `daily_plans` as today's editable snapshot
- Preserve the rule that a saved daily plan outranks a derived one
- Extend the daily plan types if needed to show plan origin, confidence, or rationale

### Relevant Files

- `src/app/dashboard/page.tsx`
- `src/components/dashboard/DailyPlanPanel.tsx`
- `src/lib/daily-plan.ts`
- `src/lib/baseline-plans/index.ts`
- new profile builder / derivation helpers

### Detailed Steps

1. Create a deterministic helper such as `buildDailyPlanFromProfile(...)`.
2. Use the durable profile as the first fallback when no saved `daily_plans` row exists for today.
3. Only fall back to the old age-band template logic if both the daily plan and the profile are missing.
4. Keep feed anchors light and derived from the same profile.
5. If needed, extend the daily plan payload to include metadata like:
   - `origin`
   - `confidence`
   - `reasonSummary`
6. Make sure derived plans stay deterministic and do not require an AI call.
7. Add tests for:
   - different wake anchors
   - different day structures
   - saved plan overriding derived plan

### Quality Gates

- A user with a durable profile but no saved daily plan sees the derived profile-based plan
- A user with a saved daily plan still sees the saved version
- Wake time differences are reflected in the plan
- The result is deterministic with no AI dependency
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.3 Codex`
- Reasoning: `medium`

Why:

- This is mostly bounded implementation and testing once the product rules are already defined.

### Prompt For A New Chat

```text
Read these first:
- docs/somni_implementation_plan_v7.md (Stage 3 only)
- docs/somni_architecture.md
- docs/somni_verification_checklist.md
- src/app/dashboard/page.tsx
- src/components/dashboard/DailyPlanPanel.tsx
- src/lib/daily-plan.ts
- src/lib/baseline-plans/index.ts
- any Stage 1 and Stage 2 profile-generation files

Task:
Complete Stage 3 of docs/somni_implementation_plan_v7.md end to end.

Requirements:
- Replace the age-only fallback with a profile-driven daily plan derivation path.
- Keep saved daily plans as the highest-priority source for today.
- Do not require an AI call to build the default daily plan.
- Preserve Somni's existing dashboard behavior where possible.

Quality gates:
- npm run lint
- npm test -- --run
- npm run build

At the end:
- Summarize how the daily plan source is chosen
- Mention any new metadata added to the plan payload
```

---

## Stage 4 - Chat-Driven Explicit Updates

### Goal

Teach Somni to separate "change today's plan" from "change the learned baseline" when the parent says something concrete in chat.

### Why This Matters

This is where Somni starts feeling smart rather than static. Explicit parent statements are high-value signals and should move the plan faster than weak log guesses.

### Scope

- Expand chat tool-calling to support durable profile changes
- Keep daily rescue changes separate from baseline shifts
- Save change events with scope, source, and confidence
- Update prompt rules so Somni does not overreact to sparse logging

### Relevant Files

- `src/app/api/chat/route.ts`
- `src/lib/ai/prompt.ts`
- `src/lib/daily-plan.ts`
- new profile helper / event helper modules
- related dashboard event-handling code if the plan stream payload changes

### Detailed Steps

1. Keep `update_daily_plan` for same-day changes.
2. Add a second bounded tool such as `update_sleep_plan_profile` for durable changes.
3. Define tool rules clearly:
   - explicit stable parent statement -> profile update
   - same-day rescue -> daily plan update
   - if both are needed, allow both
4. Add prompt instructions that explicitly say:
   - missing logs do not prove missing sleep
   - parent-reported stable patterns should be trusted more than sparse logs
   - only update durable baseline fields when the parent is clearly describing an ongoing pattern
5. Save a `sleep_plan_change_events` row for each applied change.
6. Update the assistant confirmation copy so the parent can tell what changed:
   - today's plan only
   - learned baseline
   - or both
7. Add tests for representative messages like:
   - "the plan says wake at 7 but he always wakes at 6"
   - "today's naps were awful, move bedtime earlier"
   - "daycare means she cannot nap before 9:30 on weekdays"

### Quality Gates

- Explicit baseline-style statements update the durable profile
- Same-day rescue statements update today's plan only
- Mixed cases can update both when appropriate
- Sparse logs are not treated as proof in the prompt or persistence logic
- Change events are saved with clear scope and source
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.4`
- Reasoning: `high`

Why:

- This stage mixes prompt design, tool schema design, persistence, and product judgment.

### Prompt For A New Chat

```text
Read these first:
- docs/somni_implementation_plan_v7.md (Stage 4 only)
- docs/somni_architecture.md
- docs/somni_ai_persona.md
- docs/somni_verification_checklist.md
- src/app/api/chat/route.ts
- src/lib/ai/prompt.ts
- src/lib/daily-plan.ts
- any adaptive profile / change-event files added in earlier stages

Task:
Complete Stage 4 of docs/somni_implementation_plan_v7.md end to end.

Requirements:
- Keep daily rescue changes and durable baseline changes separate.
- Add bounded tool support for durable profile updates.
- Make explicit parent statements high-confidence signals.
- Do not let sparse logging create false certainty.
- Save explainable change events.
- Update docs if the architecture or chat flow source of truth changes.

Quality gates:
- npm run lint
- npm test -- --run
- npm run build

At the end:
- Summarize the new tool behavior
- Explain how chat now distinguishes daily vs durable changes
- Mention any important prompt-rule updates
```

---

## Stage 5 - Log-Driven Adaptation Engine

### Goal

Allow Somni to adapt automatically from real sleep patterns when the evidence is strong enough, while holding steady when logs are sparse or misleading.

### Why This Is The Hardest Stage

This is the core judgment layer. It must feel intelligent without becoming overconfident.

### Scope

- Build a rule-based adaptation evaluator
- Turn logs into evidence, not assumptions
- Apply safe automatic shifts when thresholds are met
- Refuse or defer bigger structural changes when evidence is weak
- Regenerate today's plan when a durable profile change is safely applied

### Required Evidence Rules

High confidence:

- explicit stable parent statement in chat
- can update same day

Medium confidence:

- repeated pattern across at least 3 reasonably covered days in the last 5-7 days
- examples:
  - wake anchor mismatch
  - first nap consistently earlier or later than planned
  - bedtime consistently drifting because the plan is unrealistic

Low confidence:

- sparse or partial logs
- missing overnight coverage
- only one logged nap in a day
- no repeated pattern

Critical rule:

- no log does not mean no sleep
- one logged nap does not mean only one nap happened
- missing overnight logs do not prove a good night or a bad night

### Safe Auto-Changes In v1

- wake anchor shifts of modest size
- bedtime anchor shifts of modest size
- first nap anchor adjustments
- light feed-anchor timing adjustments

### Changes That Need More Evidence

- dropping a nap
- major wake-window expansion
- changes that imply night weaning or medically sensitive assumptions
- changes during illness, travel, teething, or obvious rough patches

### Relevant Files

- sleep-log server action(s) and related validation paths
- `src/lib/scoring/sleep-score.ts`
- new adaptation helpers under `src/lib/sleep-plan-*`
- dashboard/chat integration points that should reflect auto-applied updates

### Detailed Steps

1. Add a new evaluator such as `evaluateSleepPlanAdaptation(...)` that returns a structured decision:
   - `hold_steady`
   - `apply_daily_rescue`
   - `apply_baseline_shift`
2. Build a coverage/confidence layer that scores evidence without treating missing logs as missing sleep.
3. Define the first adaptation heuristics in code with tight tests.
4. Save change events whenever the evaluator applies a change.
5. Regenerate or refresh today's plan when a durable change is safely applied.
6. Keep the first version narrow. Prefer fewer trustworthy auto-changes over many clever ones.
7. Add scenario tests for:
   - sparse logs -> no durable change
   - repeated 6:00 am wakes across covered days -> wake anchor shift
   - one rough day -> no baseline shift
   - nap drop attempted too early -> blocked

### Quality Gates

- Sparse logging does not trigger a durable shift
- Repeated strong evidence can trigger a safe durable shift
- One-off rough patches do not permanently rewrite the profile
- Riskier transitions require stronger evidence
- Change events persist with rationale
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.4`
- Reasoning: `high`

Why:

- This is the most important product-judgment stage in v7.
- Default to `high`; only move to `extra high` if the implementation gets stuck.

### Prompt For A New Chat

```text
Read these first:
- docs/somni_implementation_plan_v7.md (Stage 5 only)
- docs/somni_architecture.md
- docs/somni_verification_checklist.md
- src/lib/scoring/sleep-score.ts
- the sleep-log server actions / routes
- any adaptive profile, change-event, and daily-plan builder files from earlier stages

Task:
Complete Stage 5 of docs/somni_implementation_plan_v7.md end to end.

Requirements:
- Build a rule-based log-driven adaptation engine.
- Missing logs must reduce confidence, not create false conclusions.
- Keep v1 narrow and trustworthy.
- Only safe, explainable, age-appropriate changes should auto-apply.
- Persist rationale and refresh today's plan when needed.

Quality gates:
- npm run lint
- npm test -- --run
- npm run build

At the end:
- Summarize the adaptation rules implemented
- Explain how sparse logging is handled safely
- Call out any intentionally blocked or deferred auto-adjustments
```

---

## Stage 6 - Trust, Transparency, And Parent-Facing Feedback

### Goal

Make plan changes understandable so parents can trust why Somni changed something, or why it chose not to.

### Why This Matters

An adaptive plan can feel "magical" in a bad way if the parent cannot see the reason behind it.

### Scope

- Show whether the plan is:
  - starting plan
  - learned plan
  - today's rescue plan
- Show when the plan changed
- Show why it changed in simple English
- Show low-confidence hold-steady states when appropriate

### Relevant Files

- `src/components/dashboard/DailyPlanPanel.tsx`
- `src/components/dashboard/DailyPlanPanel.module.css`
- related dashboard page and chat confirmation UI

### Detailed Steps

1. Add lightweight plan-state metadata to the dashboard panel.
2. Show a short reason line such as:
   - "Updated after repeated 6:00 am wakes across 4 logged days."
   - "Holding steady while Somni learns from more complete logs."
   - "Adjusted for today after a rough nap day."
3. Keep the tone calm, practical, and non-judgmental.
4. Avoid making the UI feel noisy or over-explanatory.
5. If helpful, show confidence as plain English rather than a technical score.
6. Ensure chat confirmations match what the dashboard says.

### Quality Gates

- The parent can tell whether the plan is a starting plan, learned plan, or same-day rescue plan
- Automatic changes show a short human explanation
- Low-confidence states do not pretend certainty
- UI remains clean on mobile
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.3 Codex`
- Reasoning: `medium`

Why:

- This is mostly UI and copy integration once the harder product logic is already in place.

### Prompt For A New Chat

```text
Read these first:
- docs/somni_implementation_plan_v7.md (Stage 6 only)
- docs/somni_ai_persona.md
- docs/somni_verification_checklist.md
- src/components/dashboard/DailyPlanPanel.tsx
- src/components/dashboard/DailyPlanPanel.module.css
- any files that now expose adaptive plan metadata or change-event summaries

Task:
Complete Stage 6 of docs/somni_implementation_plan_v7.md end to end.

Requirements:
- Show plan state and reason in a calm, simple way.
- Keep the UI mobile-friendly and low-noise.
- Make automatic changes feel explainable, not mysterious.
- Keep the tone aligned with Somni's brand.

Quality gates:
- npm run lint
- npm test -- --run
- npm run build

At the end:
- Summarize the new trust/explanation UI
- Mention any metadata surfaced to the dashboard
```

---

## Stage 7 - Verification, Regression Pack, And Rollout Safety

### Goal

Lock the feature down with repeatable checks before broader rollout.

### Why This Matters

Adaptive systems fail quietly if they are not tested against realistic edge cases.

### Scope

- Add targeted tests for new adaptation behavior
- Add a verification script for adaptive plan scenarios
- Update current docs and release notes
- Add rollout safety guidance if a feature flag is used

### Suggested Verification Scenarios

- new user gets one personalised starting plan
- same age plus different wake time leads to different starting anchors
- same age plus different sleep style changes strictness, not age biology
- explicit chat statement updates durable profile
- same-day rescue update does not rewrite the baseline
- sparse logs do not trigger a baseline shift
- repeated covered evidence does trigger a safe baseline shift
- daycare/work constraints survive across days

### Relevant Files

- adaptive plan tests added in earlier stages
- `docs/somni_verification_checklist.md`
- `docs/somni_release_checklist.md`
- optional new script under `scripts/`

### Detailed Steps

1. Add missing unit and integration tests across onboarding, daily-plan derivation, chat tools, and log adaptation.
2. Add a focused verification script such as `scripts/verify-stage7-adaptive-plans.mjs`.
3. Update the verification checklist if the new feature needs extra routine checks.
4. Update the release checklist if rollout or support handling changes.
5. Update current docs so future contributors know v7 is the active plan.
6. If rollout risk feels high, add a simple feature flag and document it clearly.

### Quality Gates

- Targeted adaptive-plan tests exist and pass
- Verification script runs cleanly
- Current docs point to v7 as the active next-step plan
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Recommended Codex Setup

- Model: `5.3 Codex`
- Reasoning: `low`

Why:

- This is mostly verification, packaging, and docs discipline.

### Prompt For A New Chat

```text
Read these first:
- docs/somni_implementation_plan_v7.md (Stage 7 only)
- docs/somni_verification_checklist.md
- docs/somni_release_checklist.md
- any adaptive-plan tests and scripts created in earlier stages

Task:
Complete Stage 7 of docs/somni_implementation_plan_v7.md end to end.

Requirements:
- Add the missing regression and verification coverage for v7.
- Update current docs and checklists where needed.
- Keep the verification workflow realistic and lightweight.
- If you add a feature flag, document it clearly.

Quality gates:
- npm run lint
- npm test -- --run
- npm run build

At the end:
- Summarize the new regression coverage
- Mention any new verification script or rollout switch
- Confirm which docs were updated
```

---

## Recommended Execution Order

1. Stage 1 - Adaptive plan data model and guardrails
2. Stage 2 - Onboarding expansion and initial recommended plan
3. Stage 3 - Daily plan derivation engine
4. Stage 4 - Chat-driven explicit updates
5. Stage 5 - Log-driven adaptation engine
6. Stage 6 - Trust, transparency, and parent-facing feedback
7. Stage 7 - Verification, regression pack, and rollout safety

## Model Selection Summary

| Stage | Complexity | Recommended Model | Reasoning | Why |
| --- | --- | --- | --- | --- |
| 1 | Medium-high | `5.4` | `medium` | Schema and architecture decisions will shape every later stage |
| 2 | High | `5.4` | `high` | Onboarding, personalisation, and initial profile logic need strong product judgment |
| 3 | Medium | `5.3 Codex` | `medium` | Mostly deterministic implementation once rules are defined |
| 4 | High | `5.4` | `high` | Prompt plus tool plus persistence design |
| 5 | High | `5.4` | `high` | Hardest logic in the feature; trust depends on it |
| 6 | Medium | `5.3 Codex` | `medium` | UI and explanation integration |
| 7 | Low-medium | `5.3 Codex` | `low` | Verification and docs work |

## Token-Usage Guidance

To keep token usage sensible without giving up quality:

- Default to `5.3 Codex` for implementation-heavy stages once the product rules are already clear.
- Use `5.4` only for stages where product judgment, LLM behavior, or adaptation rules are the main risk.
- Avoid `extra high` by default. It is not necessary for the planned path.
- Use `5.4 Mini` only for tiny follow-ups after a stage is already mostly solved.
- Use `5.2` or `5.2 Codex` only if you are repeating a very well-specified low-risk task and cost matters more than first-pass quality.

## Success Criteria For v7

Somni should be able to:

- start each family on one sensible recommended plan
- personalise that starting plan from onboarding, not just age
- separate durable baseline learning from today's rescue changes
- adapt automatically when evidence is strong
- hold steady when evidence is weak
- explain changes clearly enough that parents trust the system
