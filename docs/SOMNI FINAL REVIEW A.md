# SOMNI FINAL REVIEW A

**Amalgamated from three independent reviews:**
- Gemini 3.1 Pro — [SOMNI GEM 3.1 PRO Review A](./SOMNI%20GEM%203.1%20PRO%20Review%20A.md)
- GPT 5.4 High — [SOMNI GPT5.4 High Review A](./SOMNI%20GPT5.4%20High%20Review%20A.md)
- Claude Opus 4.6 — [SOMNI OPUS 4.6 Review A](./SOMNI%20OPUS%204.6%20Review%20A.md)

**Compiled by:** Claude Opus 4.6 (Thinking)
**Date:** 24 April 2026

---

## Executive Summary

Three independent AI reviewers assessed the Somni codebase and production environment. All three agree: **Somni's product foundation is strong, but unapplied database migrations are blocking core functionality.** Beyond that, the reviewers converge on a clear priority: pause feature work, do a focused reliability pass, then resume.

This document merges the key findings into one prioritised implementation plan with quality gates and model recommendations for each stage.

---

## Cross-Model Comparison

### What Each Model Found

| Area | Gemini 3.1 Pro | GPT 5.4 High | Claude Opus 4.6 |
|------|----------------|--------------|-----------------|
| **Critical blocker** | Onboarding broken — `day_structure` column missing | Support flow broken — `support_tickets` table missing | Onboarding broken — two migration files not applied |
| **Chat route too large** | ✅ Identified (1,100+ lines) | — Not flagged | ✅ Identified (1,154 lines), proposed module split |
| **ChatCoach.tsx too large** | ✅ Identified (500+ lines), proposed custom hook extraction | — Not flagged | — Not flagged |
| **Test account unusable** | — Not flagged | ✅ Identified in detail | ✅ Identified |
| **Support form contract mismatch** | — Not flagged | ✅ Identified (API returns `{success}` but UI expects `{id}`) | — Not flagged |
| **Support docs drift** | — Not flagged | ✅ Identified (log-based vs. table-based disagreement) | ✅ Identified |
| **Retrieval limit docs mismatch** | — Not flagged | ✅ Identified (docs say 7, code says 5) | — Not flagged |
| **Stage 5 scripts broken on Windows** | — Not flagged | ✅ Identified (`SIGTERM` doesn't work on Windows) | — Not flagged |
| **Unused Tailwind dependencies** | — Not flagged | — Not flagged | ✅ Identified |
| **Onboarding button hidden by nav** | — Not flagged | — Not flagged | ✅ Identified |
| **Date/time utility duplication** | — Not flagged | — Not flagged | ✅ Identified |
| **Product copy too corporate** | — Not flagged | ✅ Identified (e.g. "shared plan Somni is keeping in sync") | — Not flagged |
| **Automated migration pipeline** | ✅ Recommended (Vercel + Supabase CI) | — Not flagged | ✅ Recommended (CLI or checklist) |
| **Deployment parity check** | — Not checked | ✅ Confirmed (local = GitHub = Vercel) | — Not checked |
| **Billing endpoints live test** | — Not checked | ✅ Confirmed working | — Not checked |

### Common Ground (All Three Agree)

1. **The codebase is solid** — lint, tests, build, and targeted verification scripts all pass
2. **The adaptive plan architecture is the product's strongest asset** — well-designed and well-tested
3. **Unapplied database migrations are the root cause** of the critical blocking issues
4. **A reliability pass should come before the next feature push**

### Key Differences

- **Gemini** was the most concise (66 lines) but identified the fewest issues. It focused narrowly on the onboarding blocker and two refactoring ideas, then stopped. It was the only one to flag `ChatCoach.tsx` complexity.
- **GPT** was the most thorough operationally (836 lines). It went deeper into live environment verification — checking deployment parity, billing endpoints, and the support flow end-to-end. It found the most "operational" issues (support contract mismatch, script reliability, retrieval limit mismatch). It did not flag the onboarding migration issue at all.
- **Opus** sat between the two in scope (307 lines). It was the only one to identify the onboarding button overlap, Tailwind cleanup, and date utility duplication. It provided the most detailed root cause analysis for the onboarding blocker, explaining exactly which two migration files need to be applied and in what order.

### Complementary Strengths

| Model | Best at |
|-------|---------|
| Gemini 3.1 Pro | Quick, focused identification of blocking issues. Good at proposing practical code refactors. |
| GPT 5.4 High | Operational verification — checking real environments, deployment parity, live API behaviour. Strongest at identifying process gaps (test setup, script reliability, docs drift). |
| Claude Opus 4.6 | Deep code analysis and root cause tracing. Most precise about which files, lines, and migration files are involved. Best at explaining the "why" behind issues. |

---

## Unified Issue Registry

Every issue from all three reviews, deduplicated and ranked:

| # | Issue | Found by | Priority |
|---|-------|----------|----------|
| 1 | Onboarding blocked — v7 migration files not applied to Supabase | Gemini, Opus | 🔴 Critical |
| 2 | Support flow broken — `support_tickets` table missing from live DB | GPT | 🔴 Critical |
| 3 | Support form contract mismatch — API returns `{success}` but UI expects `{id}` | GPT | 🟠 High |
| 4 | Test accounts (`gentletester@test.com`, etc) added and verified | User, Opus | ✅ Completed |
| 5 | Support docs disagree (log-based vs. table-based) | GPT, Opus | 🟡 Medium |
| 6 | Retrieval limit mismatch — docs say 7 chunks, chat route uses 5 | GPT | 🟡 Medium |
| 7 | Stage 5 verification scripts hang on Windows (SIGTERM cleanup) | GPT | 🟡 Medium |
| 8 | Chat route.ts is 1,154 lines — too many responsibilities | Gemini, Opus | 🟡 Medium |
| 9 | ChatCoach.tsx is 500+ lines — logic mixed with rendering | Gemini | 🟡 Medium |
| 10 | Onboarding "Finish" button obscured by bottom nav on mobile | Opus | 🟡 Medium |
| 11 | Dashboard copy too system-oriented ("shared plan Somni is keeping in sync") | GPT | 🟢 Low |
| 12 | Unused Tailwind dependencies in package.json | Opus | 🟢 Low |
| 13 | Date/time utilities duplicated across 4+ files | Opus | 🟢 Low |
| 14 | No automated migration pipeline (Vercel → Supabase) | Gemini, Opus | 🟢 Low (process) |

---

## Implementation Plan

### Phase 0: Database Sync (Manual — You Do This)

> **This phase requires your action in the Supabase dashboard. No code agent can do this without your database credentials.**

| Step | Action | Verify |
|------|--------|--------|
| 0.1 | Open Supabase dashboard → SQL Editor | — |
| 0.2 | Paste and run `supabase/migrations/202604221940_add_sleep_plan_profiles.sql` | No errors in output |
| 0.3 | Paste and run `supabase/migrations/202604222230_expand_onboarding_preferences_for_stage2.sql` | No errors in output |
| 0.4 | Paste and run `supabase/migrations/20260414_add_support_tickets.sql` | No errors in output |
| 0.5 | Verify all three new tables exist: `sleep_plan_profiles`, `sleep_plan_change_events`, `support_tickets` | Check Tables tab in Supabase |

**Quality gate:** Sign up as a fresh user → complete onboarding → reach dashboard. Submit a support ticket → no error.
✅ **COMPLETED BY USER**

---

### Phase 1: Test Account & Verification Fixes

**Goal:** Make the QA infrastructure trustworthy so every subsequent phase can be properly verified.

| Step | Task | Details | Model Recommendation |
|------|------|---------|---------------------|
| 1.1 | Complete onboarding for the test accounts | ✅ **COMPLETED BY USER:** 3 new archetype accounts created (Gentle, Balanced, Fast Track) | — |
| 1.2 | Fix onboarding button overlap | ✅ **COMPLETED BY AI:** Added `padding-bottom: 100px` to `.actions` in `OnboardingForm.module.css` | — |
| 1.3 | Fix Stage 5 scripts for Windows | ✅ **COMPLETED BY AI:** Extracted `stopProcessTree` and used `taskkill` for all stage 5 scripts | — |
| 1.4 | Update `TEST_ACCOUNTS.md` | ✅ **COMPLETED BY AI:** Documented the 3 new archetype accounts | — |

**Quality gates:**
```
npm run lint
npm test -- --run
npm run build
```
- Test account can access `/dashboard`, `/chat`, `/sleep`, `/billing` without redirect
- Stage 5 smoke script completes without hanging on Windows

---

### Phase 2: Support Flow Reliability

**Goal:** Make the support feature work end-to-end for real users.

| Step | Task | Details | Model Recommendation |
|------|------|---------|---------------------|
| 2.1 | Fix support API response contract | ✅ **COMPLETED BY AI:** API now selects and returns `{ id: data.id }` | — |
| 2.2 | Fix support form success handling | ✅ **COMPLETED BY AI:** Confirmed `SupportForm.tsx` already uses `payload.id` | — |
| 2.3 | Align support documentation | ✅ **COMPLETED BY AI:** Updated `somni_architecture.md` (checklist was already fine) | — |

**Quality gates:**
```
npm run lint
npm test -- --run
npm run build
node scripts/verify-stage5-smoke.mjs
```
- Submit a support request from the UI → see success message
- Verify row exists in `support_tickets` table in Supabase

---

### Phase 3: Documentation Truth Pass

**Goal:** Eliminate all known documentation drift so every doc matches the real app.

| Step | Task | Details | Model Recommendation |
|------|------|---------|---------------------|
| 3.1 | Fix retrieval limit docs | ✅ **COMPLETED BY AI:** Architecture doc updated to 5 chunks to match code | — |
| 3.2 | Add migration step to release checklist | ✅ **COMPLETED BY AI:** Added to release checklist | — |
| 3.3 | Verify env var docs match code | ✅ **COMPLETED BY AI:** Documented `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in architecture doc | — |
| 3.4 | Confirm archive/current doc separation | ✅ **COMPLETED BY AI:** Confirmed `archive/` is separated | — |

**Quality gate:**
- No contradictions between any current doc and the running code

---

### Phase 4: Code Quality Refactors

**Goal:** Reduce complexity in the two largest files and eliminate code duplication.

| Step | Task | Details | Model Recommendation |
|------|------|---------|---------------------|
| 4.1 | Extract Gemini streaming into `src/lib/ai/gemini.ts` | Move `streamGeminiResponse()`, model config, function-call parsing out of route.ts | **5.3 Codex — High** (multi-file refactor with import rewiring) |
| 4.2 | Extract plan persistence into `src/lib/ai/chat-plan-persistence.ts` | Move `saveChatPlanUpdates()` and related helpers | **5.3 Codex — High** (same refactor session as 4.1) |
| 4.3 | Extract source attribution into `src/lib/ai/chat-sources.ts` | Move `toSourceAttribution()`, `getConfidenceLabel()`, SSE helpers | **5.3 Codex — Medium** (simpler extraction) |
| 4.4 | Extract chat message hook from `ChatCoach.tsx` | Create `useChatSession()` custom hook that owns message state, streaming, and API calls; leave ChatCoach as a pure render component | **5.3 Codex — High** (client component refactor, state management) |
| 4.5 | Centralise date/time utilities | Create `src/lib/date-utils.ts` with shared `parseDateOnly()`, `getAgeInWeeks()`, timezone helpers. Update imports in `dashboard/page.tsx`, `sleep-plan-profile-init.ts`, `daily-plan-derivation.ts` | **5.3 Codex — Medium** (utility extraction + import updates) |
| 4.6 | Remove unused Tailwind dependencies | Remove `@tailwindcss/postcss` and `tailwindcss` from `devDependencies` | **5.4 Mini — Low** (one command: `npm uninstall`) |

**Quality gates:**
```
npm run lint
npm test -- --run
npm run build
node scripts/verify-stage7-adaptive-plans.mjs
```
- Chat route.ts should be under 400 lines after extraction
- ChatCoach.tsx should be under 200 lines after hook extraction
- All existing tests still pass (no regressions)

---

### Phase 5: Product Polish

**Goal:** Improve parent-facing copy and mobile experience without changing logic.

| Step | Task | Details | Model Recommendation |
|------|------|---------|---------------------|
| 5.1 | Dashboard copy pass | Replace system-oriented phrases like "This is the shared plan Somni is keeping in sync for [babyName] today" with warmer, parent-focused wording | **5.4 — Medium** (needs good writing judgement, not just code) |
| 5.2 | Support page copy pass | Review and soften any corporate/technical language | **5.4 — Medium** (same writing pass) |
| 5.3 | Mobile readability check | Browser-test dashboard, chat, sleep, and support on a 375px viewport; fix any overflow or truncation | **5.3 Codex — Medium** (CSS adjustments) |

**Quality gates:**
```
npm run lint
npm run build
```
- Manual visual check on mobile viewport — no clipped text, no hidden buttons, no overflow

---

### Phase 6: Integration Testing & Migration Safety

**Goal:** Prevent the migration-gap problem from ever happening again.

| Step | Task | Details | Model Recommendation |
|------|------|---------|---------------------|
| 6.1 | Write onboarding smoke test script | Create `scripts/verify-onboarding-smoke.mjs` that exercises signup → onboarding → dashboard against a running dev server | **5.3 Codex — High** (new test script, needs HTTP client + form submission) |
| 6.2 | Investigate Supabase CLI integration | Evaluate whether `supabase db push` can be added to the Vercel build or a CI step so migrations are applied automatically | **5.4 — High** (research + configuration, not pure code) |

**Quality gates:**
- `node scripts/verify-onboarding-smoke.mjs` passes on a fresh account
- If CLI integration is adopted: migrations auto-apply on deploy

---

## Model Selection Guide

For reference when assigning these tasks in Codex:

| Task Type | Recommended Model | Reasoning Effort | Why |
|-----------|-------------------|------------------|-----|
| Single CSS/docs change | 5.4 Mini | Low | Trivial, no reasoning needed |
| Multiple small docs changes | 5.4 Mini | Medium | Needs cross-referencing but no complex logic |
| API / component bug fix | 5.3 Codex | Medium | Understands codebase patterns, moderate complexity |
| Multi-file refactor | 5.3 Codex | High | Needs to track imports, types, and test impacts across files |
| New test script creation | 5.3 Codex | High | Needs to understand existing verification patterns and match them |
| Product copy writing | 5.4 | Medium | Needs tone awareness and writing quality, not just code ability |
| Architecture / research decisions | 5.4 | High | Needs broad reasoning about tradeoffs |
| Complex schema or adaptation logic | Claude Opus (external) | — | Reserved for high-stakes changes where correctness is critical |

---

## Phase 4 Execution Log (24 April 2026)

- [x] 4.1 Extracted Gemini streaming and tool config into `src/lib/ai/gemini.ts`
- [x] 4.2 Extracted plan persistence into `src/lib/ai/chat-plan-persistence.ts`
- [x] 4.3 Extracted source attribution and SSE/retrieval helpers into `src/lib/ai/chat-sources.ts`
- [x] 4.4 Created `src/components/chat/useChatSession.ts` and reduced `ChatCoach.tsx` to render-focused component
- [x] 4.5 Added `src/lib/date-utils.ts` and rewired date/time helpers in `dashboard/page.tsx`, `sleep-plan-profile-init.ts`, and `daily-plan-derivation.ts`
- [x] 4.6 Removed `@tailwindcss/postcss` and `tailwindcss` from `devDependencies` and cleaned `postcss.config.mjs`

**Phase 4 quality gate results:**

- [x] `npm run lint`
- [x] `npm test -- --run`
- [x] `npm run build`
- [x] `node scripts/verify-stage7-adaptive-plans.mjs`

**Line-count targets:**

- [x] `src/app/api/chat/route.ts` is under 400 lines (**382**)
- [x] `src/components/chat/ChatCoach.tsx` is under 200 lines (**189**)

## Phase 5 Execution Log (24 April 2026)

- [x] 5.1 Rewrote dashboard copy in the daily plan panel to sound warmer and more parent-facing without changing plan logic
- [x] 5.2 Rewrote support page and support form copy to feel softer and clearer while keeping expectations intact
- [x] 5.3 Completed a manual 375px viewport check on `/dashboard`, `/chat`, `/sleep`, and `/support`, then tightened mobile spacing and controls where needed

**Phase 5 quality gate results:**

- [x] `npm run lint`
- [x] `npm run build`
- [x] Manual 375px viewport check completed for dashboard/chat/sleep/support
- [x] No overflow, clipped text, or hidden controls remained after fixes

## Summary

The three reviews paint a consistent picture:

> **Somni is a genuine product with a strong technical foundation. The adaptive plan system is the real differentiator. The main risk is not product quality — it's operational reliability gaps caused by database migrations not being applied and test infrastructure not being maintained.**

The fix path is clear: apply the three pending migrations, repair the test account, fix the support flow, clean up documentation, then proceed with code quality refactoring and product polish. Each phase has explicit quality gates so you know exactly when it's done.

Total estimated effort across all 6 phases: **~2–3 focused sessions** for the reliability fixes (Phases 0–3), plus **~2 sessions** for the refactoring and polish (Phases 4–5), plus **~1 session** for the integration testing work (Phase 6).
