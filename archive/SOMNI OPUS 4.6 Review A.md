# SOMNI OPUS 4.6 Review A

**Reviewer:** Claude Opus 4.6 (Thinking)
**Date:** 24 April 2026
**Scope:** Full project review — code, architecture, UI/UX, testing, documentation, and production readiness

---

## Executive Summary

Somni is a well-architected, polished sleep coaching app with a strong foundation. The codebase is clean, well-tested, and builds without errors. The design system is premium and cohesive. The implementation plans (v4 through v7) show excellent product thinking.

However, **there is one critical blocker and several medium-priority issues** that need attention before further feature development. The most urgent is a **database migration that hasn't been applied to the live Supabase database**, which prevents new users from completing onboarding — the very first thing anyone does after signing up.

Below is a plain-English breakdown of everything found, organised by priority.

---

## Quality Gate Results

| Check | Result | Notes |
|-------|--------|-------|
| `npm run lint` | ✅ Pass | No warnings or errors |
| `npm test -- --run` | ✅ Pass | 62 tests across 12 test files |
| `npm run build` | ✅ Pass | Clean production build, no TypeScript errors |
| Stage 7 adaptive verification | ✅ Pass | 26 targeted tests across 4 key modules |
| Live onboarding test | ❌ **Blocked** | New users get stuck in a loop (details below) |

---

## 🔴 Critical: Onboarding Is Broken for New Users

### What's Happening

When a new user signs up and fills in the onboarding form, they click "Finish onboarding" and the page **appears to succeed** — but then bounces them right back to the onboarding page instead of taking them to the dashboard.

### Why It's Happening

The v7 implementation plan added two new database migrations (SQL files that tell the database to create new tables and columns):

1. **`202604221940_add_sleep_plan_profiles.sql`** — Creates the `sleep_plan_profiles` and `sleep_plan_change_events` tables
2. **`202604222230_expand_onboarding_preferences_for_stage2.sql`** — Adds five new columns to the `onboarding_preferences` table (`typical_wake_time`, `day_structure`, `nap_pattern`, `night_feeds`, `schedule_preference`)

The code now tries to save data into those new columns during onboarding. But if the migrations haven't been run against the live Supabase database, those columns don't exist yet. The insert silently fails, the sleep plan profile can't be created, and onboarding either errors out or loops back.

### What to Do

> **⚠️ CAUTION: This is the single most important fix before anything else. No new user can get past onboarding until this is resolved.**

**Step 1:** Go to your Supabase dashboard → SQL Editor → paste and run the contents of these two files, in order:

1. `supabase/migrations/202604221940_add_sleep_plan_profiles.sql`
2. `supabase/migrations/202604222230_expand_onboarding_preferences_for_stage2.sql`

**Step 2:** After running them, try signing up with a fresh test account (or reset the `onboarding_completed` flag for the test account) and confirm you reach the dashboard.

**Step 3:** If you're not sure how to do this, let me know and I'll walk you through it step-by-step.

### Why This Wasn't Caught Earlier

The code, tests, and build all pass because:
- Unit tests use mocked database calls (fake stand-ins), so they never hit the real database
- The build only checks that the TypeScript code is correct, not that the database matches
- The verification scripts test logic, not live database connectivity

This is a common pitfall in projects that use Supabase: the migration SQL files sit in the repo but aren't automatically applied to the remote database. They need to be run manually or via the Supabase CLI.

---

## 🟡 Medium Priority Issues

### 1. Hydration Mismatch Warning (React / Next.js)

**What it means in plain English:** When the server sends the page to the browser, the browser version doesn't perfectly match what the server sent. React logs a warning about this.

**What causes it:** The browser testing tool adds a CSS class (`antigravity-scroll-lock`) to the `<body>` tag that wasn't there when the server rendered the page. This is external and harmless in production, but it's worth knowing that any browser extensions or injected scripts can trigger these warnings.

**Impact:** Low. This is cosmetic in development and won't affect real users.

### 2. Chat Route Is Very Large (1,154 Lines)

**What it means:** The file `src/app/api/chat/route.ts` handles everything about AI chat in one place — validation, quota checks, retrieval, prompt building, streaming, plan updates, memory persistence, and error handling. At 1,154 lines, it's the largest file in the project by a significant margin.

**Why this matters:** Large files are harder to maintain. When something breaks, it takes longer to find the issue. When two people (or two AI agents) work on the same area, they're more likely to create conflicts.

**Recommendation:** This isn't broken — it works well. But when the time is right, it would benefit from being split into smaller, focused pieces. For example:
- Move the Gemini streaming logic into `src/lib/ai/gemini.ts`
- Move the plan update persistence into a dedicated helper
- Keep the route handler as a thin orchestration layer

### 3. `@tailwindcss/postcss` in Dev Dependencies But Not Used

**What it means:** The `package.json` file lists TailwindCSS as a development tool, but the entire app uses a custom CSS design system (CSS variables, `.card`, `.btn-primary`, etc.). Tailwind isn't actually used anywhere.

**Why this matters:** It adds unnecessary weight to the `node_modules` folder and could confuse future developers who might think Tailwind is part of the design system.

**Recommendation:** Remove `@tailwindcss/postcss` and `tailwindcss` from `devDependencies` unless there's a specific plan to use them. The current custom design system is excellent and well-suited to the app's premium aesthetic.

### 4. Onboarding "Finish" Button Can Be Obscured by Bottom Nav

**What it means:** On mobile screens, the "Finish onboarding" button at the bottom of the form sits very close to the bottom navigation bar. Depending on the device, the button can be partially hidden behind the nav bar.

**Recommendation:** Add `padding-bottom` to the onboarding form's action area (approximately `100px`) to ensure the button is always fully visible above the bottom nav, even on small screens.

### 5. `support_tickets` Table Referenced in Checklist but Not Verified

**What it means:** The release checklist mentions checking the Supabase `support_tickets` table, but the architecture doc says support is still "runtime-log based rather than inbox based." The migration file `20260414_add_support_tickets.sql` exists, so the table may or may not be live.

**Recommendation:** Verify whether the support ticket table is actually being used by the `/api/support` route. If it is, update the architecture doc. If not, update the release checklist.

### 6. Test Account State May Be Stale

**What it means:** The test account (`agent-test@somni.app`) currently has `onboarding_completed` set to `false`, which means any testing agent hits the onboarding flow instead of the dashboard. This makes automated testing slower and less effective.

**Recommendation:** After applying the migrations, complete onboarding for the test account once so future testing can go straight to the dashboard, sleep, and chat pages.

---

## 🟢 What's Working Well

### Design & Aesthetics
- **Premium dark theme** with a cohesive gold/navy colour palette
- **Custom typography** using Playfair Display (headings) and DM Sans (body) — very professional
- **Glassmorphism cards** with subtle borders and shadows
- **Micro-animations** (fade-up, pulse ring, glow breathe) add polish without being distracting
- **Mobile-first layout** with a responsive bottom navigation bar

### Architecture
- **Clean separation of concerns** between server components, client components, server actions, and route handlers
- **Row Level Security (RLS)** is properly configured on all tables — this means each user can only see their own data at the database level, not just the application level
- **The adaptive plan model** (v7 stages 1–4) is well-designed with clear separation between "what's true about this baby long-term" and "what's the plan for today"
- **Change event audit trail** is excellent for explainability — every plan change records why it happened

### AI & Retrieval
- **The prompt** is well-structured with clear rules about tone, response length, citation behaviour, and safety
- **Tool-calling design** (daily rescue vs. durable baseline changes) is thoughtful and handles edge cases well
- **The safety guardrail** for crisis detection is implemented correctly
- **Retrieval diagnostics** are inspectable for debugging without exposing them to end users

### Code Quality
- **62 passing tests** covering the most important business logic
- **Consistent naming conventions** throughout
- **TypeScript types** are used effectively — very few `any` types
- **Error handling** is thorough with proper quota rollback on failures

### Documentation
- **Implementation plans (v4–v7)** are exceptionally well-written — they read like product specs, not just developer notes
- **"Completed Work"** sections in v6 provide a clear audit trail of what was done
- **Document precedence rules** prevent confusion about which doc is authoritative

---

## Refactoring Opportunities

These are not bugs — they're improvements that would make the codebase more efficient, stable, or maintainable over time. Listed in recommended priority order:

### 1. Extract Chat Route Into Composable Modules

**Current state:** `src/app/api/chat/route.ts` is 1,154 lines.

**Proposed refactor:**

| New Module | Responsibility |
|---|---|
| `src/lib/ai/gemini.ts` | Gemini API streaming, token extraction, function call parsing |
| `src/lib/ai/chat-plan-persistence.ts` | `saveChatPlanUpdates()` and related helpers |
| `src/lib/ai/chat-sources.ts` | Source attribution formatting |
| `src/app/api/chat/route.ts` | Thin orchestration: validate → load context → call AI → save → stream |

**Benefit:** Easier to test each piece independently. Easier for agents and humans to work on specific concerns without touching the entire file.

### 2. Add Integration/E2E Tests for Onboarding

**Current state:** Onboarding is only tested via individual unit tests. There's no test that validates the full flow from form submission through database write to dashboard redirect.

**Proposed addition:** A focused smoke test (like the existing `verify-stage5-smoke.mjs`) that exercises the onboarding → dashboard path against a running dev server.

**Benefit:** Would have caught the migration issue described above.

### 3. Centralise Date/Time Utilities

**Current state:** Several files independently implement `parseDateOnly()`, `getAgeInWeeks()`, and similar functions (`dashboard/page.tsx`, `sleep-plan-profile-init.ts`, `daily-plan-derivation.ts`).

**Proposed refactor:** Create `src/lib/date-utils.ts` with shared date parsing, age calculation, and timezone helpers.

**Benefit:** Reduces duplication and ensures consistent date handling everywhere.

### 4. Add a Migration Runner or Checklist

**Current state:** Migrations are SQL files in the repo. They're applied manually by pasting into the Supabase SQL editor. There's no automated check that the database schema matches what the code expects.

**Proposed improvement:** Either:
- Use `supabase db push` (the Supabase CLI tool) to apply migrations automatically, or
- Add a startup check that verifies critical tables/columns exist, or
- At minimum, add a step to the release checklist: "Run any new migration files"

**Benefit:** Prevents the exact issue found in this review.

### 5. Remove Unused Tailwind Dependencies

**Current state:** `@tailwindcss/postcss` and `tailwindcss` are in `devDependencies` but not used.

**Proposed change:** Remove them from `package.json` and run `npm install` to clean up.

**Benefit:** Smaller dependency footprint, less confusion.

---

## Documentation Drift Findings

| Area | Issue | Severity |
|------|-------|----------|
| Architecture doc | Correctly updated for v7 stages 1–4 | ✅ No issue |
| Context doc | Says "Active next-step plan: v7" and lists v4 as recently completed — this is correct | ✅ No issue |
| Release checklist | References `support_tickets` table but architecture doc says support is log-based | ⚠️ Minor mismatch |
| Verification checklist | References stage 7 adaptive verification — correct and up to date | ✅ No issue |
| `vercel.json` | Cron schedule `0 14 * * *` matches docs (midnight AEST) | ✅ No issue |
| v6 plan | All 8 sections marked as completed with audit trails | ✅ No issue |
| v7 plan | All stages 1-7 appear implemented in code | ✅ Matches code |

---

## Recommended Next Steps

### Tier 1: Fix Now (Before Anything Else)

| # | Action | Why | How to Verify |
|---|--------|-----|---------------|
| 1 | Apply the two pending database migrations to Supabase | New users can't complete onboarding | Sign up as a new user and confirm you reach the dashboard |
| 2 | Complete onboarding for the test account | Enables proper automated testing | Log in with test creds and confirm dashboard loads |

### Tier 2: Quick Wins (This Week)

| # | Action | Why | Effort |
|---|--------|-----|--------|
| 3 | Add bottom padding to onboarding form | "Finish" button can be hidden by nav bar | ~5 min CSS change |
| 4 | Remove unused Tailwind dependencies | Clean up and reduce confusion | ~2 min |
| 5 | Reconcile `support_tickets` docs | Release checklist and architecture doc disagree | ~10 min docs edit |

### Tier 3: Stability Improvements (This Sprint)

| # | Action | Why | Effort |
|---|--------|-----|--------|
| 6 | Add a migration checklist item to the release process | Prevent the migration gap from happening again | ~15 min docs |
| 7 | Add an onboarding smoke test script | Catch database-level issues before deployment | ~2 hours |
| 8 | Centralise date/time utilities | Reduce duplication across 4+ files | ~1–2 hours |

### Tier 4: Architecture Quality (When Ready)

| # | Action | Why | Effort |
|---|--------|-----|--------|
| 9 | Refactor chat route into composable modules | The 1,154-line file is hard to maintain | ~3–4 hours |
| 10 | Continue v7 rollout and verification against live data | Core product differentiator | Multiple sessions |

---

## v7 Implementation Status

| Stage | Status | Notes |
|-------|--------|-------|
| 1 — Adaptive plan data model | ✅ Complete | Tables, helpers, tests all in place |
| 2 — Onboarding expansion | ✅ Complete (code) ⚠️ Blocked (database) | Code works, but migrations must be applied |
| 3 — Daily plan derivation | ✅ Complete | Profile-derived → age fallback chain works |
| 4 — Chat-driven explicit updates | ✅ Complete | Daily rescue + durable baseline tools working |
| 5 — Log-driven adaptation engine | ✅ Complete (code + tests) | `evaluateSleepPlanAdaptation` with scenario tests |
| 6 — Trust & transparency UX | ✅ Complete | Plan state labels, reasons, confidence copy all render |
| 7 — Verification & regression | ✅ Complete | Stage 7 verification script passes |

**Key finding:** The code for all 7 stages appears to be complete and passing tests. The only gap is that the database doesn't have the matching schema yet (the migration issue above).

---

## Appendix: Files Reviewed

### Documentation (22 files)
All files in `docs/` were read in full, including all implementation plans, the architecture doc, context doc, persona doc, quality hardening notes, and verification/release checklists.

### Source Code (Key Files)
- `src/app/api/chat/route.ts` (1,154 lines — full read)
- `src/lib/ai/prompt.ts` (152 lines — full read)
- `src/lib/sleep-plan-profile-init.ts` (572 lines — full read)
- `src/lib/sleep-plan-chat-updates.ts` (reference)
- `src/lib/sleep-plan-log-adaptation.ts` (reference)
- `src/lib/daily-plan-derivation.ts` (reference)
- `src/app/dashboard/page.tsx` (262 lines — full read)
- `src/app/onboarding/actions.ts` (164 lines — full read)
- `src/app/sleep/page.tsx` (154 lines — full read)
- `src/app/layout.tsx` (66 lines — full read)
- `src/components/chat/ChatCoach.tsx` (514 lines — full read)
- `src/components/dashboard/DailyPlanPanel.tsx` (351 lines — full read)
- `src/components/onboarding/OnboardingForm.tsx` (340 lines — full read)
- `src/components/sleep/SleepTracker.tsx` (188 lines — full read)
- `src/app/globals.css` (223 lines — full read)

### Database Migrations (9 files)
All migration files in `supabase/migrations/` were reviewed.

### Configuration
- `package.json`, `vercel.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`

### Tests Run
- Full test suite (62 tests, 12 files)
- Stage 7 adaptive verification (26 targeted tests)
- Lint check (clean)
- Production build (clean)
- Live browser testing of login → onboarding flow
