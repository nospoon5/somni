# Somni Stage 5 Live Log

This log tracks Stage 5 monetization work, verification, and blockers in execution order.

## 2026-04-03 - Session Log

### Completed In Code

- Added Stage 5 usage helper migration:
  - `supabase/migrations/20260403_add_billing_usage_functions.sql`
- Added server-only Supabase admin helper:
  - `src/lib/supabase/admin.ts`
- Added billing and quota helpers:
  - `src/lib/billing/usage.ts`
  - `src/lib/billing/stripe.ts`
  - `src/lib/billing/subscriptions.ts`
- Updated `/api/chat` to:
  - create or read stored subscription state
  - enforce the free-tier cap server-side only
  - return a structured `429` payload with reset context and upgrade hint
  - bypass the cap for premium access based on stored subscription state
  - release quota on failed non-premium requests
- Updated `/chat` UI to:
  - show plan state
  - show a dedicated limit-hit card with reset context
  - provide upgrade buttons and a billing portal action
- Added Stripe route handlers:
  - `src/app/api/billing/checkout/route.ts`
  - `src/app/api/billing/portal/route.ts`
  - `src/app/api/billing/webhook/route.ts`
- Added Stage 5 verification script:
  - `scripts/verify-stage5-usage-limit.mjs`

### Verification Passed

- `npm run lint` -> pass
- `npm run build` -> pass
- `node scripts/verify-stage5-usage-limit.mjs` -> pass
  - confirms the 10th free message succeeds
  - confirms the 11th free message returns `429`
  - confirms the `429` payload includes reset context
  - confirms premium access bypasses the cap using stored `subscriptions` state

### Live Environment Checks

- Live Supabase retrieval RPC check:
  - `match_corpus_chunks` is still not applied in the live project
  - result: app remains on fallback retrieval mode
  - exact RPC error: `PGRST202 Could not find the function public.match_corpus_chunks(...) in the schema cache`
- Live sign-up recheck:
  - checked at `2026-04-02T21:31:33.692Z`
  - a live sign-up succeeded with `somni-stage2-recheck-1775165490521@mailinator.com`
  - result: auth user created, no session returned because confirmation flow still applies
  - cleanup: the temporary auth user was deleted after the check

### Notes

- `src/lib/billing/usage.ts` includes a fallback path if the Stage 5 quota SQL helper has not yet been applied in the live Supabase project.
- Stripe checkout, portal, and webhook routes are implemented but not yet sandbox-verified because Stripe env vars are not present in the app environment yet.
- The build still reports the existing Next.js 16 deprecation warning for `src/middleware.ts`; this was not changed in this Stage 5 pass.

## 2026-04-03 - Stripe Sandbox Verification

### Environment Wiring

- Added the real Stripe sandbox environment values locally in `.env.local`:
  - secret key
  - publishable key
  - restricted key for reference
  - monthly price id
  - annual price id
  - webhook signing secret

### Verification Passed

- `node scripts/verify-stage5-stripe.mjs` -> pass
  - creates an authenticated temporary user
  - verifies `/api/billing/checkout` returns a Stripe Checkout URL
  - verifies `/api/billing/portal` returns a Stripe Billing Portal URL
  - posts a signed test webhook to `/api/billing/webhook`
  - confirms the `subscriptions` row is updated from the webhook payload

### Current Stage 5 Status

- Server-side usage enforcement is verified
- Stored subscription gating is verified
- Stripe checkout is verified in sandbox
- Stripe portal is verified in sandbox
- Stripe webhook subscription sync is verified in sandbox
- Remaining Stage 5 follow-up: browser-verify the limit-hit UI state in `/chat`
