# Somni - Architecture

## Purpose

This is the technical source of truth for the current Somni app.

If another current document disagrees with this file, this file wins until it is deliberately
updated.

## Product Shape

Somni is a mobile-first web app and installable PWA for baby sleep coaching.

Current live product areas:

- Auth
- Onboarding
- Sleep logging
- Sleep score
- AI chat with retrieval
- Daily plans
- Adaptive plan foundation
- Billing
- Support
- AI memory backfill

## Technical Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 App Router |
| UI runtime | React 19 |
| Hosting | Vercel |
| Auth and database | Supabase |
| Vector search | pgvector in Supabase Postgres |
| LLM | Gemini chat models |
| Embeddings | `gemini-embedding-001` stored as `vector(768)` |
| Billing | Stripe Checkout and Customer Portal |
| Styling | App-level CSS and design tokens |

## System Principles

1. Keep product logic in code, not in prompts.
2. Prefer Server Components, Route Handlers, and Server Actions over client-only logic.
3. Safety, honesty, and trust matter more than cleverness.
4. Retrieval should stay inspectable and testable.
5. The app should degrade gracefully when background or external systems fail.

## Main Routes

| Route | Purpose | Auth |
| --- | --- | --- |
| `/` | Landing page | Public |
| `/login` | Sign in | Public |
| `/signup` | Sign up | Public |
| `/onboarding` | Baby setup and sleep style questions | Authenticated |
| `/dashboard` | Score, plan, and quick actions | Authenticated |
| `/chat` | AI coaching chat | Authenticated |
| `/sleep` | Sleep logging and sleep history | Authenticated |
| `/profile` | Profile and baby settings | Authenticated |
| `/billing` | Upgrade and billing management | Authenticated |
| `/support` | Support form | Public (submission requires auth) |
| `/privacy` | Privacy policy | Public |
| `/terms` | Terms of service | Public |
| `/disclaimer` | Medical and product disclaimer | Public |

## Route Handlers

These are the current App Router Route Handlers under `src/app/api/**/route.ts`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/chat` | POST | Enforce quota, retrieve corpus, generate reply, persist messages |
| `/api/score` | GET | Return the current sleep score summary |
| `/api/support` | POST | Validate and log support requests |
| `/api/billing/checkout` | POST | Create a Stripe Checkout session |
| `/api/billing/portal` | POST | Create a Stripe Customer Portal session |
| `/api/billing/webhook` | POST | Sync Stripe subscription state |
| `/api/cron/memory-backfill` | GET | Run AI memory backfill with cron auth |

Current note:

- Sleep logging, onboarding, and some profile edits are handled with Server Actions rather
  than route handlers.

## Auth and Session Handling

- Supabase Auth provides email/password authentication.
- Session refresh is handled in `src/proxy.ts`.
- `src/proxy.ts` is session maintenance, not the main security boundary.
- Real authorization still happens in server-side code and Row Level Security policies.

## High-Level Flows

### Onboarding Flow

1. User signs up or signs in.
2. User creates a baby profile.
3. User answers the sleep style questionnaire plus practical planning questions such as
   wake time, day shape, naps, night feeds, and preferred schedule feel.
4. App stores the onboarding preferences, creates one recommended starting
   `sleep_plan_profile`, and marks onboarding complete.

### Sleep Logging Flow

1. User starts or ends sleep sessions in the app.
2. Server logic validates ownership and active-session rules.
3. Dashboard and score calculations read the recent 7-day sleep window.
4. If Somni has fewer than 3 covered days, fewer than 4 logs, or only day-only/night-only
   coverage, it stays in a learning state instead of showing a numeric score.

### Chat Flow

1. Verify the user session.
2. Load the current profile and baby.
3. Enforce free-tier chat quota.
4. Load recent sleep context and the current daily plan.
5. Calculate the sleep score summary.
6. Retrieve relevant corpus chunks.
7. Build the prompt with profile, score, plan, memory, and retrieved context.
8. Generate the assistant response.
9. Persist chat messages and metadata.
10. Optionally update the daily plan.
11. Sync or backfill AI memory.

### Billing Flow

1. Frontend requests checkout or billing portal route handler.
2. Stripe owns payment and subscription state.
3. Webhook updates `subscriptions` as the local application view of Stripe state.

### Support Flow

1. User opens `/support` after a problem page.
2. Client logic stores the last in-app page and prefills it as support origin context.
3. User submits a support request from `/support`.
4. Route handler validates the payload.
5. Request is written to runtime logs as structured JSON.

Support logs include:

- `origin_page` for the issue page
- `support_page` for the form URL
- `page_url` as a compatibility alias for `origin_page`

Current tradeoff:

- This avoids adding a support table or email dependency for now.
- It is simple, but not yet a full support inbox.

### Background Flow

- Vercel cron calls `/api/cron/memory-backfill`.
- Current schedule in `vercel.json`: once per day at `0 14 * * *` (midnight AEST, UTC+10).
- The job refreshes `babies.ai_memory` from recent conversations.

## Data Model Summary

Core tables:

- `profiles`
- `babies`
- `onboarding_preferences`
- `sleep_logs`
- `messages`
- `subscriptions`
- `usage_counters`
- `corpus_chunks`
- `daily_plans`
- `sleep_plan_profiles`
- `sleep_plan_change_events`

Important data notes:

- `babies.ai_memory` stores a rolling AI memory summary for that baby.
- `onboarding_preferences` stores both the five sleep-style scores and the practical
  starting-plan inputs used for the first durable profile.
- `daily_plans` stores one practical plan per baby per day.
- `sleep_plan_profiles` stores one durable learned baseline plan per baby.
- `sleep_plan_change_events` stores append-only explainability history for profile and
  daily-plan changes.
- `sleep_logs` has a unique partial index so each baby can only have one active session.
- `usage_counters` resets by the user's timezone, defaulting to `Australia/Sydney`.
- `corpus_chunks` stores retrieval text, metadata, and embeddings.

## Adaptive Plan Model

Somni now distinguishes between two kinds of plan state:

- `sleep_plan_profiles`
  - the durable learned baseline for that baby
  - stores current best guesses such as usual wake time, target bedtime, nap count,
    wake-window pattern, day structure, schedule preference, and adaptation confidence
- `daily_plans`
  - today's editable snapshot only
  - can reflect same-day rescue changes without rewriting the durable baseline
- `sleep_plan_change_events`
  - append-only audit history
  - stores whether a change affected the durable profile or only today's plan, plus the
    source, confidence, rationale, and before/after snapshots

Current implementation note:

- Stage 2 now creates one starting `sleep_plan_profile` during onboarding and safely
  bootstraps one for older accounts if it is missing.
- Stage 3 now renders daily plans in this order:
  1. saved `daily_plans` row for today (highest priority)
  2. deterministic profile-derived daily plan from `sleep_plan_profiles`
  3. age-only baseline fallback only when both are missing

## Retrieval and AI

- Retrieval uses Gemini embeddings.
- Current retrieval breadth is 7 chunks.
- Current minimum similarity threshold is `0.3`.
- Age band and methodology are soft relevance hints, not hard filters.
- A lightweight second-pass re-ranker helps surface stronger matches for:
  - early morning waking
  - daycare or work constraints
  - nap transitions
  - vague reset-plan queries
- Safety-relevant guidance must still surface even when methodology differs.
- Retrieval diagnostics can be logged with `SOMNI_LOG_RETRIEVAL=true`.
- Retrieval diagnostics can be returned in chat debug flows with
  `SOMNI_INCLUDE_RETRIEVAL_DEBUG=true`, eval mode, or `?retrieval_debug=1`.

## Environment Variables

Main runtime variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `GEMINI_API_KEY`
- `GEMINI_CHAT_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_MEMORY_MODEL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET`
- `AI_MEMORY_BACKFILL_BABY_LIMIT`
- `AI_MEMORY_BACKFILL_MESSAGE_LIMIT`

## Quality Expectations

- `npm test -- --run` should stay green.
- `npm run build` should stay green.
- Retrieval and chat verification scripts should stay usable after AI-related changes.
- Docs should be updated when routes, environment variables, or architecture decisions change.

## Known Architecture Gaps

- Support is runtime-log based rather than inbox based.
- Retrieval ranking is now inspectable, but the heuristics should stay narrow and be reviewed
  whenever the corpus changes materially.

## Companion Docs

- `docs/somni_context.md` for product intent
- `docs/somni_corpus_plan.md` for corpus rules
- `docs/somni_implementation_plan_v4.md` for completed AI and RAG work
- `docs/somni_implementation_plan_v7.md` for the next adaptive-plan execution plan
