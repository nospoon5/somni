# Somni - Architect Handoff to Builder

## Purpose

This file translates the architecture into practical implementation guidance for the next coding steps.

It should remain aligned with:

- `docs/somni_architecture.md`
- `docs/somni_implementation_plan_v2.md`

## Current Builder Objective

The product foundations are in place. The current work is Stage C:

1. Keep the public copy honest and specific
2. Replace any draft or placeholder trust/legal wording
3. Keep README and handoff docs aligned with the real app
4. Re-check the live public pages after wording changes

## Technical Decisions

| Decision | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Use Route Handlers and Server Actions |
| Auth | Supabase Auth | Email and password only in V1 |
| Data access | Supabase SSR helpers | Server-first |
| Security | RLS plus server-side ownership checks | Do not rely only on redirects |
| Styling | Vanilla CSS | No Tailwind for Somni feature work unless explicitly requested |
| Chat model | Gemini `gemini-2.5-flash` | Streaming responses |
| Embeddings | Gemini `gemini-embedding-001` stored as `vector(768)` | Match the architecture and migration |
| Billing | Stripe | Checkout plus Customer Portal |

## Route Plan

| Route | Status |
| --- | --- |
| `/` | Built and styled for Somni |
| `/login` | Built and connected to Supabase auth action |
| `/signup` | Built and connected to Supabase auth action |
| `/onboarding` | Built with multi-step form and DB writes |
| `/dashboard` | Built with sleep score summary |
| `/chat` | Built with streaming chat shell |
| `/sleep` | Built with start/end actions and recent history |
| `/privacy` | Built |
| `/terms` | Built |
| `/disclaimer` | Built |
| `/billing` | No standalone route in V1; billing lives in chat |

## API and Server Work Plan

| Path | Responsibility |
| --- | --- |
| `src/app/api/chat/route.ts` | Usage checks, retrieval, Gemini call, persistence |
| `src/app/api/score/route.ts` | Score summary response |
| `src/app/onboarding/actions.ts` | Save onboarding answers and completion state |
| `src/app/sleep/actions.ts` | Sleep log start/end actions |
| `src/app/api/billing/checkout/route.ts` | Stripe checkout |
| `src/app/api/billing/portal/route.ts` | Stripe portal |
| `src/app/api/billing/webhook/route.ts` | Stripe webhook processing |

Auth mutations also live in server actions where that keeps the implementation simpler and cleaner.

## Folder Direction

Target structure:

```text
src/
  app/
    api/
    chat/
    dashboard/
    disclaimer/
    login/
    onboarding/
    privacy/
    signup/
    sleep/
    terms/
  components/
    auth/
    chat/
    onboarding/
    sleep/
    ui/
  lib/
    ai/
    billing/
    scoring/
    supabase/
```

This does not require scaffolding everything immediately. It is a direction for upcoming implementation.

## Builder Rules

1. Prefer Server Components by default.
2. Add `'use client'` only when interactivity requires it.
3. Keep data validation and authorization on the server.
4. Use the architecture doc as the source of truth for schema and flow.
5. Avoid adding libraries unless they solve a real problem.
6. Preserve the premium, calm, mobile-first product tone.

## Data Model Expectations

The V1 schema should match the architecture doc exactly.

Important implementation details:

- `profiles` includes `timezone` and `onboarding_completed`
- `babies` uses `date_of_birth`
- `onboarding_preferences` stores five explicit question score columns
- `sleep_logs` uses `started_at`, `ended_at`, `is_night`, and `tags`
- `messages` stores safety metadata for assistant responses
- `usage_counters` resets by user timezone, not fixed AEST
- `corpus_chunks` stores metadata-rich chunks with `vector(768)`

## Acceptance Criteria

### Auth

- User can sign up
- User can sign in
- User can sign out
- Invalid credentials show clear feedback
- Protected routes redirect cleanly

### Onboarding

- New users reach onboarding after account creation or first login
- Baby details are stored correctly
- Sleep style score and label are stored correctly
- `profiles.onboarding_completed` is updated on completion

### Sleep Logging

- User can create and finish a sleep session quickly
- Day and night state is handled correctly
- Tags persist correctly

### Chat

- Chat messages stream
- Retrieved sources are attributable
- Safety notes render distinctly
- Usage limits are enforced server-side

### Billing

- Free users hit a real limit
- Checkout and portal sessions work
- Webhooks update the subscription state

## What Not To Build Yet

- Partner sharing
- Multi-baby-first UI
- Push notifications
- Feeding tracking
- Predictive schedule generation
- Native apps

## Notes For The Next Builder Pass

The next practical coding pass should stay on Stage C copy and readiness work.

Good next steps are:

1. Keep legal and trust pages specific and truthful
2. Keep README and handoff docs aligned with the live app
3. Browser-check public wording after any copy change
4. Leave Stage D sign-off work for later

That order keeps the launch-trust pass focused without reopening already-verified product flows.
