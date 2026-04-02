# Somni - Architecture

## Purpose

This document is the V1 technical source of truth for Somni.

It exists to align product intent, implementation planning, database design, and application structure before further feature work continues.

If another document conflicts with this file, this file wins until it is deliberately updated.

## Product Summary

Somni is a mobile-first web app and installable PWA for infant sleep coaching.

Core V1 promise:

- Parents can sign up, add their baby, log sleep, and receive personalized, source-backed coaching.
- Advice is grounded in curated infant sleep guidance, not generic chatbot output.
- The product tone is calm, non-judgmental, and safe-sleep compliant.
- Australia is the default launch market, but the architecture should not hardcode Australia-only assumptions where a user-specific setting is better.

## V1 Scope

Included in V1:

- Email and password authentication with Supabase Auth
- Baby profile setup and onboarding questionnaire
- Sleep logging
- Sleep score calculation
- AI coaching chat with RAG
- Free-tier usage limits
- Stripe subscription management
- Installable PWA shell

Explicitly out of scope for initial implementation:

- Partner sharing
- Multi-baby focused UI
- Push notifications
- Feeding and diaper tracking
- Predictive nap scheduling
- Native mobile apps

The data model may support future expansion where doing so is low cost, but the user experience should stay tightly scoped to a single primary baby in V1.

## Technical Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 App Router |
| Runtime | React 19 |
| Hosting | Vercel |
| Auth and DB | Supabase |
| Vector Search | pgvector in Supabase Postgres |
| LLM | Gemini `gemini-2.5-flash` |
| Embeddings | Gemini `gemini-embedding-001` embeddings, stored as `vector(768)` for this project |
| Payments | Stripe Checkout and Customer Portal |
| Styling | Vanilla CSS with design tokens and component styles |
| PWA | Manifest plus service worker |

## Architecture Principles

1. Server-first by default. Use Server Components, Route Handlers, and Server Actions first, and add Client Components only where interactivity requires them.
2. Safety before cleverness. Safe-sleep guardrails, emergency redirects, and honest uncertainty handling are mandatory.
3. One-handed and sleep-deprived friendly UX. Core flows should be fast, obvious, and forgiving.
4. Product logic lives in code, not prompts. Scoring, usage limits, age banding, and billing state are application responsibilities.
5. Retrieval should be transparent and auditable. Sources and safety signals must be inspectable after the fact.

## System Overview

High-level request flow:

1. The user interacts with the Next.js app.
2. Auth state is maintained through Supabase SSR helpers and secure cookies.
3. Protected server work happens in Route Handlers and Server Actions.
4. App data lives in Supabase Postgres under Row Level Security.
5. Corpus embeddings are stored in pgvector and queried during chat requests.
6. Gemini generates responses using retrieved context plus user-specific runtime context.
7. Stripe manages subscription checkout and billing portal flows.

## App Routes

| Route | Purpose | Auth |
| --- | --- | --- |
| `/` | Landing page and product marketing | Public |
| `/login` | Sign in | Public |
| `/signup` | Sign up | Public |
| `/onboarding` | Baby details and sleep style onboarding | Authenticated, incomplete onboarding only |
| `/dashboard` | Sleep score, recent insights, quick actions | Authenticated |
| `/chat` | AI coaching chat | Authenticated |
| `/sleep` | Sleep logging and recent history | Authenticated |
| `/profile` | Account, baby profile, timezone, logout | Authenticated |
| `/billing` | Subscription management | Authenticated |

## Server Endpoints

For Next.js 16, these are App Router Route Handlers under `src/app/api/**/route.ts`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/chat` | POST | Run usage checks, retrieve context, call Gemini, persist messages |
| `/api/sleep` | GET, POST, PATCH, DELETE | Manage sleep logs |
| `/api/score` | GET | Return the current sleep score summary |
| `/api/profile` | GET, PUT | Return and update profile and baby details |
| `/api/onboarding` | POST | Save onboarding details and mark onboarding complete |
| `/api/billing/checkout` | POST | Create a Stripe Checkout session |
| `/api/billing/portal` | POST | Create a Stripe Customer Portal session |
| `/api/billing/webhook` | POST | Process Stripe webhooks |

Authentication mutations such as sign up, sign in, and sign out should use Server Actions unless a Route Handler is clearly preferable.

## Auth and Authorization

Auth provider:

- Supabase Auth
- Email and password only in V1

Session model:

- Supabase manages the authenticated session.
- Secure cookies are refreshed through the SSR integration.

Next.js 16 note:

- The repo may continue to use `src/middleware.ts` for Supabase session refresh compatibility.
- That file is a session maintenance mechanism, not the primary security boundary.
- Authorization must still be enforced in Route Handlers, Server Actions, and server-side data access helpers.

Authorization rules:

- Every user-facing table must have Row Level Security enabled.
- A user may only access rows tied to their own profile or their own babies.
- Corpus content may be readable by authenticated users, but write access should stay server-side only.

Recommended server-side pattern:

1. Read the authenticated user with the Supabase server client.
2. Resolve the current profile and active baby on the server.
3. Enforce ownership checks close to the query or mutation.
4. Never rely only on route redirects for data protection.

## Onboarding Model

The onboarding flow should collect:

- Baby name
- Date of birth
- Biggest issue
- Feeding type
- Bedtime range
- Five sleep style question scores

The onboarding flow should end with:

- A created baby record
- A created onboarding preferences record
- A derived sleep style label
- A boolean flag on the profile indicating onboarding completion

## RAG Architecture

### Corpus Input

The curated markdown chunks in `corpus/chunks/` are the canonical V1 knowledge base input.

Each chunk includes frontmatter for:

- `topic`
- `age_band`
- `methodology`
- `sources`
- `confidence`

### Embedding Ingestion

Ingestion is an explicit server-side or local script step, not a runtime client feature.

The uploader must:

1. Read each markdown chunk.
2. Parse frontmatter and body content.
3. Generate a stable `chunk_id`.
4. Request an embedding for the content.
5. Store the chunk and embedding in `corpus_chunks`.

Project rule:

- Somni stores embeddings as `vector(768)`.
- The uploader must generate or normalize output that matches the stored dimension.

### Runtime Retrieval

For each chat request:

1. Embed the user query.
2. Query pgvector for the most relevant chunks.
3. Prefer chunks matching the baby's current age band.
4. Prefer chunks aligned with the selected sleep style where appropriate.
5. Always allow safe-sleep content to surface even if methodology differs.
6. Return the top 5 chunks for prompt assembly.

Filtering rule:

- `age_band` and `methodology` are soft relevance hints, not hard exclusions in all cases.
- Safety-critical guidance should never be filtered out just because methodology differs.

### Prompt Assembly

The LLM input should include:

- System prompt
- Baby profile summary
- Sleep style summary
- Recent sleep logs
- Current score summary
- Retrieved corpus chunks
- Recent conversation history
- The latest user message

## Chat Flow

`/api/chat` should follow this order:

1. Verify the user session.
2. Load the current profile and active baby.
3. Enforce usage limits.
4. Load recent sleep logs.
5. Calculate the current score summary.
6. Retrieve relevant corpus chunks.
7. Assemble the prompt.
8. Call Gemini with streaming.
9. Persist the user message and assistant message.
10. Persist structured response metadata such as sources and safety fields.
11. Increment usage counters.

## Sleep Logging

Sleep logging is designed around a minimal 3am flow:

1. Start sleep
2. End sleep
3. Optionally add tags or notes

Rules:

- `ended_at` may be null while a sleep session is active.
- `is_night` is derived automatically but can be overridden when needed.
- Tags remain lightweight and user-friendly.

Supported V1 tags:

- `easy_settle`
- `hard_settle`
- `short_nap`
- `false_start`
- `self_settled`
- `needed_help`

## Sleep Score

The sleep score is an application-level calculation, not an AI-generated value.

V1 score categories:

- Night sleep: 40 points
- Day sleep: 25 points
- Total sleep: 20 points
- Settling: 15 points

Inputs:

- Last 7 days of sleep logs
- Baby age band
- Tags and timing patterns

Outputs:

- Total score from 0 to 100
- Status label
- Strongest area
- Biggest challenge
- Tonight's focus

Implementation note:

- V1 may calculate the score on demand.
- Caching is an optimization, not a prerequisite.
- If caching is introduced later, invalidation should happen whenever a sleep log changes.

## Usage Limits

Free tier rules for V1:

- 10 chat messages per day

Reset rule:

- Usage resets at midnight in the user's configured timezone.
- The default timezone is `Australia/Sydney` until the user changes it.

This replaces the earlier inconsistent "AEST plus user timezone" wording.

## Billing

Stripe responsibilities:

- Checkout for upgrades
- Customer Portal for subscription management
- Webhooks for source-of-truth subscription state changes

Billing data should not be inferred from the frontend. The `subscriptions` table is the local application view of Stripe state.

## PWA and Offline Strategy

V1 PWA goals:

- Installable app shell
- Manifest and icons
- Fast repeat loads
- Offline-friendly sleep logging direction

Important implementation boundary:

- Chat is online-only in V1.
- Offline sleep logging is desirable, but if full queueing and sync are not stable enough yet, the product should degrade gracefully rather than pretend data is saved.

If offline queueing is implemented, the architecture should use:

- Local browser storage for pending sleep log events
- Retry on reconnect
- Idempotent server writes where practical

## Data Model

The following schema is the intended V1 target and should drive migration work.

### `profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Matches `auth.users.id` |
| `email` | `text` unique not null | Sourced from auth |
| `full_name` | `text` null | Optional for account settings |
| `timezone` | `text` not null default `'Australia/Sydney'` | Used for daily reset logic and date display |
| `onboarding_completed` | `boolean` not null default `false` | Controls first-run flow |
| `created_at` | `timestamptz` not null | |
| `updated_at` | `timestamptz` not null | |

### `babies`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK -> `profiles.id` | Owner of the baby record |
| `name` | `text` not null | |
| `date_of_birth` | `date` not null | |
| `biggest_issue` | `text` null | Onboarding dropdown value |
| `feeding_type` | `text` null | `breast`, `bottle`, or `mixed` |
| `bedtime_range` | `text` null | Onboarding dropdown value |
| `created_at` | `timestamptz` not null | |

### `onboarding_preferences`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `baby_id` | `uuid` FK -> `babies.id` unique | One V1 onboarding record per baby |
| `question_1_score` | `numeric(3,1)` not null | |
| `question_2_score` | `numeric(3,1)` not null | |
| `question_3_score` | `numeric(3,1)` not null | |
| `question_4_score` | `numeric(3,1)` not null | |
| `question_5_score` | `numeric(3,1)` not null | |
| `sleep_style_score` | `numeric(3,1)` not null | Derived average or weighted result |
| `sleep_style_label` | `text` not null | `gentle`, `balanced`, or `fast-track` |
| `created_at` | `timestamptz` not null | |

### `sleep_logs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `baby_id` | `uuid` FK -> `babies.id` | |
| `started_at` | `timestamptz` not null | |
| `ended_at` | `timestamptz` null | Null while active |
| `is_night` | `boolean` not null | Auto-derived with manual override support |
| `tags` | `text[]` not null default empty array | Uses the allowed V1 tag set |
| `notes` | `text` null | Optional caregiver note |
| `created_at` | `timestamptz` not null | |

### `messages`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK -> `profiles.id` | |
| `baby_id` | `uuid` FK -> `babies.id` | |
| `conversation_id` | `uuid` not null | Groups a chat thread |
| `role` | `text` not null | `user` or `assistant` |
| `content` | `text` not null | Stored message text |
| `sources_used` | `jsonb` null | Retrieved corpus metadata shown to the user |
| `safety_note` | `text` null | Stored for assistant messages when relevant |
| `is_emergency_redirect` | `boolean` not null default `false` | |
| `confidence` | `text` null | `high`, `medium`, or `low` for assistant messages |
| `model` | `text` null | Optional audit field |
| `created_at` | `timestamptz` not null | |

### `subscriptions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK -> `profiles.id` unique | One active subscription view per profile in V1 |
| `stripe_customer_id` | `text` null | |
| `stripe_subscription_id` | `text` null | |
| `plan` | `text` not null default `'free'` | `free`, `monthly`, or `annual` |
| `status` | `text` not null default `'inactive'` | `inactive`, `trialing`, `active`, `past_due`, `canceled` |
| `current_period_end` | `timestamptz` null | |
| `is_trial` | `boolean` not null default `false` | |
| `created_at` | `timestamptz` not null | |
| `updated_at` | `timestamptz` not null | |

### `usage_counters`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK -> `profiles.id` | |
| `usage_date` | `date` not null | Date in the user's timezone |
| `message_count` | `integer` not null default `0` | |
| `last_incremented_at` | `timestamptz` not null | |

Recommended uniqueness:

- Unique index on `profile_id, usage_date`

### `corpus_chunks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `chunk_id` | `text` unique not null | Stable identifier derived from the source chunk |
| `topic` | `text` not null | |
| `age_band` | `text` null | |
| `methodology` | `text` not null default `'all'` | `gentle`, `balanced`, `fast-track`, or `all` |
| `content` | `text` not null | Chunk body content |
| `sources` | `jsonb` not null | Array of `{ name, url }` objects |
| `confidence` | `text` not null default `'medium'` | |
| `embedding` | `vector(768)` not null | Project-standard vector size |
| `created_at` | `timestamptz` not null | |

## AI Response Contract

The assistant response returned to the client should be shaped as:

```json
{
  "message": "string",
  "sources": [
    {
      "name": "Red Nose Australia",
      "topic": "safe sleeping"
    }
  ],
  "safety_note": "string | null",
  "is_emergency_redirect": false,
  "confidence": "high | medium | low"
}
```

Notes:

- `message` is the natural-language coaching response.
- `sources` are subtle attribution, not a wall of citations.
- `safety_note` is rendered distinctly.
- `is_emergency_redirect` allows the UI to escalate urgent scenarios.

## Error Handling

| Scenario | Expected Handling |
| --- | --- |
| Gemini call fails | Return a calm retryable error and log the failure server-side |
| No relevant corpus chunks are found | Fall back to general guidance and lower confidence |
| Usage limit reached | Return `429` with reset information and upgrade context |
| Auth session expired | Redirect to `/login` and preserve the intended path when practical |
| Invalid sleep log input | Reject with clear validation errors |
| Billing webhook fails | Log and rely on Stripe retries |
| User is offline | Disable chat and avoid pretending online-only actions succeeded |

## Alignment Notes

This cleanup intentionally changes and clarifies several earlier assumptions:

- App Router terminology now uses Route Handlers and Server Actions, not generic "API Routes" language.
- Auth redirects are no longer described as the main security layer.
- The daily usage reset rule is based on the user's timezone.
- The onboarding schema is now explicit instead of using vague `q1-q5 answers` wording.
- The messages schema now matches the AI response contract more closely.
- The corpus schema is explicit and optimized for uploader implementation.

This document should be used to align:

- `docs/somni_implementation_plan.md`
- `supabase/migrations/*.sql`
- auth and onboarding code
- the corpus uploader script
