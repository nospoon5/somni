# Somni - Architecture

## Purpose

This is the technical source of truth for the current Somni app.

If another current document disagrees with this file, this file wins until it is deliberately
updated.

## Product Shape

Somni is a mobile-first web app and installable PWA for baby sleep coaching.

Current live product areas:

- Auth
- Onboarding and active-baby selection
- Sleep logging
- Sleep score
- AI chat with retrieval
- Daily plans
- Balanced same-day schedule adaptation
- Caregiver sharing
- Web Push alerts, quiet hours, and an in-app notification feed
- Billing
- Support
- AI memory backfill
- Privacy export and deletion
- Next Best Action and caregiver handoff context

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
| Push delivery | Web Push with VAPID and a service worker |
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
| `/invite/accept` | Validate and accept a caregiver invitation after sign-in | Public handoff; authenticated acceptance |
| `/onboarding` | Baby setup and sleep style questions | Authenticated |
| `/dashboard` | Score, plan, and quick actions | Authenticated |
| `/chat` | AI coaching chat | Authenticated |
| `/sleep` | Sleep logging and sleep history | Authenticated |
| `/profile` | Profile and baby settings | Authenticated |
| `/billing` | Upgrade and billing management | Authenticated |
| `/support` | Support form | Public (submission requires auth) |
| `/admin/support` | Support triage inbox | Authenticated administrator only |
| `/privacy` | Privacy policy | Public |
| `/terms` | Terms of service | Public |
| `/disclaimer` | Medical and product disclaimer | Public |

## Route Handlers

These are the current App Router Route Handlers under `src/app/api/**/route.ts`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/chat` | POST | Enforce quota, retrieve corpus, generate reply, persist messages, and apply bounded daily-plan or durable-profile updates |
| `/api/score` | GET | Return the current sleep score summary |
| `/api/support` | POST | Validate and store support requests in `support_tickets` |
| `/api/billing/checkout` | POST | Create a Stripe Checkout session |
| `/api/billing/portal` | POST | Create a Stripe Customer Portal session |
| `/api/billing/webhook` | POST | Sync Stripe subscription state |
| `/api/cron/memory-backfill` | GET | Run AI memory backfill with cron auth |
| `/api/notifications/subscribe` | POST, DELETE | Save or remove the signed-in caregiver's browser push subscription |

Current note:

- Sleep logging, onboarding, and some profile edits are handled with Server Actions rather
  than route handlers.

## Auth and Session Handling

- Supabase Auth provides email/password authentication.
- Session refresh is handled in `src/proxy.ts`.
- `src/proxy.ts` is session maintenance, not the main security boundary.
- Real authorization still happens in server-side code and Row Level Security policies.
- The selected baby id is stored in an HTTP-only, same-site cookie. Server-side access helpers
  validate that the signed-in profile owns the baby or has an accepted caregiver share before
  any route reads or writes baby-scoped data.

## High-Level Flows

### Onboarding Flow

1. User signs up or signs in, or returns from a valid caregiver invitation.
2. A new primary user creates a baby profile. Existing owners and accepted caregivers can switch
   among babies they are authorised to access.
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
5. Accepted caregivers other than the actor receive an in-app notification; eligible browser
   subscriptions also receive a push unless the recipient's quiet hours suppress it.
6. Database triggers preserve the actor in `logged_by`, keep the baby and creation timestamp
   immutable, and restrict edits/deletes to sleep started within the last 48 hours.
7. A unique completed-interval index makes retries for the same baby/start/end idempotent.

### Caregiver Invitation Flow

1. The permanent baby owner creates a pending caregiver share for one email address.
2. Somni generates a 32-byte random token, stores only its SHA-256 hash, and returns the raw token
   once in the invitation link. Pending links expire after seven days.
3. A signed-out recipient is sent through login or signup and returned only to a validated internal
   invitation path; pending family data is not exposed before acceptance.
4. The `accept_baby_invite` database function atomically verifies the authenticated JWT email,
   raw token, pending status, and expiry, then clears the token and grants the single supported
   `caregiver` role.
5. Direct authenticated updates to `baby_shares` are denied. Owners rotate pending tokens through
   `rotate_baby_invite`, and `babies.profile_id` is immutable; ownership transfer is not supported.

### Balanced Schedule Rescue Flow

1. A completed morning sleep log can arrive through the sleep UI or the chat logging tool.
2. If the wake time differs from the durable baseline by at least 20 minutes, Somni calculates
   damped shifts for later naps and bedtime, rounded to five minutes.
3. The proposed targets are stored as pending rather than silently changing today's plan.
4. The dashboard explains the proposed rescue and lets the parent accept or dismiss it.

### Caregiver Notification Flow

1. A caregiver enables browser notifications from profile settings; the authenticated API stores
   the browser subscription against that caregiver's profile.
2. Starting or completing a sleep session finds other accepted caregivers for the baby.
3. Somni writes each recipient's in-app feed row when their feed is enabled.
4. Somni checks the recipient's timezone and quiet-hours window before attempting Web Push.
5. The service worker displays allowed pushes, while the dashboard bell shows unread feed rows
   and supports marking them all read.

### Chat Flow

1. Verify the user session.
2. Load the current profile and baby.
3. Enforce free-tier chat quota.
4. Load recent sleep context, the durable learned sleep profile, and the current daily plan.
5. Calculate the sleep score summary.
6. Retrieve relevant corpus chunks.
7. Build the prompt with the baby profile, learned baseline, today's plan, score, memory, and retrieved context.
8. Generate the assistant response.
9. Persist chat messages and metadata.
10. Optionally apply bounded chat tools:
    - `update_daily_plan` for same-day rescue changes only
    - `update_sleep_plan_profile` for clear ongoing patterns that should change the durable baseline
11. Write `sleep_plan_change_events` rows for each applied daily or durable change.
12. Sync or backfill AI memory.

### Billing Flow

1. Frontend requests checkout or billing portal route handler.
2. Stripe owns payment and subscription state.
3. Webhook updates `subscriptions` as the local application view of Stripe state.

### Support Flow

1. User opens `/support` after a problem page.
2. Client logic stores the last in-app page and prefills it as support origin context.
3. User submits a support request from `/support`.
4. Route handler validates the payload.
5. Request is inserted into the `support_tickets` table.
6. An authorised admin reviews and updates the ticket through `/admin/support`.

Ticket context includes:

- `origin_page` for the issue page
- `support_page` for the form URL
- `page_url` as a compatibility alias for `origin_page`

Current operational note:

- The former returning-row/RLS failure is resolved: normal-user insertion does not request a
  returned row. The server-only recent-ticket count fails closed if the admin query is unavailable.
- There is no automatic email forwarding; the admin inbox must be checked operationally.

### Privacy Flow

1. A signed-in profile can request a paginated, allowlisted JSON export from Profile. Secrets,
   invite token hashes, push credentials, Stripe identifiers, and other caregivers' identifiers
   are excluded.
2. Only the permanent owner can delete a baby. One parent-row deletion atomically cascades through
   baby-owned tables.
3. Account deletion requires the server-checked phrase `DELETE ACCOUNT`, removes pending invites
   addressed to the user, cancels/deletes Stripe customer state when present, then uses the
   server-only Supabase Admin API to delete the auth user and cascading profile data.
4. Logout and successful deletion clear Somni-prefixed local and session storage in the browser.

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
- `baby_shares`
- `push_subscriptions`
- `notification_logs`
- `support_tickets`

Important data notes:

- `babies.ai_memory` stores a rolling AI memory summary for that baby.
- `onboarding_preferences` stores both the five sleep-style scores and the practical
  starting-plan inputs used for the first durable profile.
- `daily_plans` stores one practical plan per baby per day.
- `sleep_plan_profiles` stores one durable learned baseline plan per baby.
- `sleep_plan_change_events` stores append-only explainability history for profile and
  daily-plan changes.
- `sleep_logs` has a unique partial index so each baby can only have one active session.
- `sleep_logs.logged_by` is database-attributed to the authenticated actor. Audit fields are
  immutable and history older than 48 hours cannot be edited or deleted by caregivers.
- A second unique partial index prevents duplicate completed rows for an identical
  `(baby_id, started_at, ended_at)` interval.
- `usage_counters` resets by the user's timezone, defaulting to `Australia/Sydney`.
- `corpus_chunks` stores retrieval text, metadata, and embeddings.
- `baby_shares` records accepted and pending caregiver access to a baby.
- `push_subscriptions` stores owner-scoped browser endpoints and encryption keys.
- `notification_logs` stores the owner-readable in-app notification feed.
- `support_tickets` stores authenticated support submissions for admin triage; normal users must
  not be able to list other tickets.
- `profiles` stores push, feed, quiet-hours, and suppression-window preferences.

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
- Stage 4 now lets chat update these layers separately:
  - same-day rescue changes save to `daily_plans` only
  - explicit parent-reported ongoing patterns update `sleep_plan_profiles`
  - each applied change writes an explainable `sleep_plan_change_events` row with scope,
    source, confidence, rationale, and before/after snapshots
- Log- and chat-created morning wake entries can now propose a damped same-day rescue in
  `daily_plans.pending_rescue_targets`. The parent must accept it before active targets change.

## Retrieval and AI

- Retrieval uses Gemini embeddings.
- Current retrieval breadth is 5 chunks.
- Current minimum similarity threshold is `0.3`.
- Age band and methodology are soft relevance hints, not hard filters.
- A lightweight second-pass re-ranker helps surface stronger matches for:
  - early morning waking
  - daycare or work constraints
  - nap transitions
  - vague reset-plan queries
- Safety-relevant guidance must still surface even when methodology differs.
- Retrieval diagnostics can be logged by server configuration with
  `SOMNI_LOG_RETRIEVAL=true` and returned only when the server enables
  `SOMNI_INCLUDE_RETRIEVAL_DEBUG=true` or a request passes authorised evaluation mode.
- Browser-controlled debug query parameters and unauthenticated evaluation headers do not enable
  diagnostics. Evaluation requests require `SOMNI_EVAL_SECRET` (at least 32 characters), use
  constant-time comparison, and remain read-only: no quota consumption, message persistence,
  memory writes, or plan changes.

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
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `SOMNI_LOG_LATENCY` (server-side diagnostics)
- `SOMNI_LOG_RETRIEVAL` (server-side diagnostics)
- `SOMNI_INCLUDE_RETRIEVAL_DEBUG` (server-controlled response diagnostics; keep disabled in production)
- `SOMNI_EVAL_SECRET` (untracked evaluation-only secret, minimum 32 characters)

`SOMNI_FORCE_BILLING_FAILURE` is a local failure-injection switch, not a production setting.

## Linked Database Hardening State

On 19 July 2026, `npx supabase migration list --linked` showed local and linked history aligned
through `20260719130000`. The final hardening sequence is:

- `202607181751_secure_invite_tokens.sql`: hashed, expiring caregiver invitation tokens.
- `202607182300_sleep_logs_attribution.sql`: caregiver attribution for sleep logs.
- `20260719090000_authorization_hardening.sql`: atomic invite acceptance/rotation, caregiver-only
  delegation, hidden pending shares, and immutable permanent ownership.
- `20260719120000_sleep_log_audit_hardening.sql`: database-owned attribution/audit fields and the
  48-hour history-integrity boundary.
- `20260719130000_sleep_log_idempotency.sql`: duplicate completed-interval protection.

## Quality Expectations

- `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, and
  `npm audit --omit=dev` should stay green.
- `npm run verify:stage7:adaptive`, `node scripts/verify-stage4-retrieval.mjs`, and
  `npm run verify:links` are the maintained deterministic verification commands.
- Release candidates run `npx playwright test` serially against a production build and the
  approved non-production accounts; the suite must not create or delete auth users.
- AI changes also run the Python evaluation tests/dry run and, for launch evidence, the authorised
  read-only benchmark described in `somni_eval/README.md`.
- Docs should be updated when routes, environment variables, or architecture decisions change.

## Known Architecture Gaps

- Per-request CSP nonces deliberately make HTML routes dynamic. Stage 7 must measure the latency
  and caching cost; production script and style-element policy must not be weakened to recover it.
- React still emits a small number of inline style attributes, so production CSP retains the
  narrower `style-src-attr 'unsafe-inline'` exception while blocking inline scripts and script
  attributes.
- Account export is complete and paginated at the data-source layer but assembled in memory; a
  streaming/background export is a future scale improvement, not an Alpha launch blocker.
- Support has no email forwarding, so operational coverage of `/admin/support` remains required.
- Retrieval ranking is now inspectable, but the heuristics should stay narrow and be reviewed
  whenever the corpus changes materially.
- Launch readiness still depends on the Stage 7 AI benchmark, performance evidence, rehearsed
  backup/restore and rollback, and the formal decision; these are evidence/operations gaps rather
  than unresolved Stage 0 engineering defects.

## Companion Docs

- `docs/somni_context.md` for product intent
- `docs/Somni_Implementation_Plan_Alpha_1.2.md` for the live sequential execution plan
- `docs/somni_corpus_plan.md` for corpus rules
- `docs/Chat_QA_and_Testing_Plan.md` for the current chat evaluation framework
- `docs/security_model.md` for security boundaries and residual risk
- `docs/privacy_operations.md` for export, deletion, and retention behavior
- `docs/backup_restore_runbook.md` and `docs/deployment_runbook.md` for recovery and release
- `docs/incident_response.md`, `docs/billing_reconciliation.md`, and
  `docs/analytics_and_launch.md` for launch operations
- `archive/somni_implementation_plan_v4.md` for completed historical AI and RAG work
- `archive/somni_implementation_plan_v7.md` for the completed historical adaptive-plan plan
- `archive/Implementation_Plan_Schedule_Adaptation.md` for the completed schedule-rescue rollout
- `archive/Implementation_Plan_Notifications.md` for the completed notification rollout
