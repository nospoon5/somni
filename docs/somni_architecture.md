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
| `/support` | Support form | Authenticated |
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
3. User completes the five-question sleep style questionnaire.
4. App stores onboarding preferences and marks onboarding complete.

### Sleep Logging Flow

1. User starts or ends sleep sessions in the app.
2. Server logic validates ownership and active-session rules.
3. Dashboard and score calculations read the latest sleep data.

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

1. User submits a support request from `/support`.
2. Route handler validates the payload.
3. Request is written to runtime logs as structured JSON.

Current tradeoff:

- This avoids adding a support table or email dependency for now.
- It is simple, but not yet a full support inbox.

### Background Flow

- Vercel cron calls `/api/cron/memory-backfill`.
- Current schedule in `vercel.json`: once per day at `0 0 * * *`.
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

Important data notes:

- `babies.ai_memory` stores a rolling AI memory summary for that baby.
- `daily_plans` stores one plan per baby per day.
- `sleep_logs` has a unique partial index so each baby can only have one active session.
- `usage_counters` resets by the user's timezone, defaulting to `Australia/Sydney`.
- `corpus_chunks` stores retrieval text, metadata, and embeddings.

## Retrieval and AI

- Retrieval uses Gemini embeddings.
- Current retrieval breadth is 7 chunks.
- Current minimum similarity threshold is `0.3`.
- Age band and methodology are soft relevance hints, not hard filters.
- Safety-relevant guidance must still surface even when methodology differs.

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
- Sleep score sparse-data behavior still needs a product decision and implementation cleanup.
- Lint is currently red because of two legacy helper scripts.
- Retrieval still needs better observability for edge-case misses.

## Companion Docs

- `docs/somni_context.md` for product intent
- `docs/somni_corpus_plan.md` for corpus rules
- `docs/somni_implementation_plan_v4.md` for completed AI and RAG work
- `docs/somni_implementation_plan_v5.md` for the next execution plan
