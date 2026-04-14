# Somni

Somni is a sleep coaching app for parents of babies and young children. It combines
structured sleep logging, a daily plan, and a source-backed AI coach tailored to each baby.

## What is in the app today

- Public marketing page at `/`
- Email/password auth at `/login` and `/signup`
- Onboarding at `/onboarding`
- Dashboard at `/dashboard`
- AI coaching chat at `/chat`
- Sleep logging at `/sleep`
- Profile settings at `/profile`
- Billing at `/billing`
- Support form at `/support`
- Legal pages at `/privacy`, `/terms`, and `/disclaimer`

## Main technical pieces

- Next.js 16 App Router
- React 19
- Supabase Auth and Postgres
- Gemini for chat, embeddings, and AI memory extraction
- Stripe for paid billing
- Vercel cron for AI memory backfill

## Key API routes

- `/api/chat`
- `/api/score`
- `/api/support`
- `/api/billing/checkout`
- `/api/billing/portal`
- `/api/billing/webhook`
- `/api/cron/memory-backfill`

Sleep logging, onboarding, and some profile updates are handled with Server Actions rather
than route handlers.

## Core environment variables

Required for normal local development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `STRIPE_WEBHOOK_SECRET`

Common AI and background-job variables:

- `GEMINI_CHAT_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_MEMORY_MODEL`
- `CRON_SECRET`
- `AI_MEMORY_BACKFILL_BABY_LIMIT`
- `AI_MEMORY_BACKFILL_MESSAGE_LIMIT`

Evaluation-only variables:

- `EVAL_DEV_PORT`
- `EVAL_CHAT_COOLDOWN_MS`
- `EVAL_JUDGE_MODEL`
- `EVAL_JUDGE_COOLDOWN_MS`
- `EVAL_JUDGE_RETRIES`

Debug-only variable:

- `SOMNI_FORCE_BILLING_FAILURE`
- `SOMNI_LOG_RETRIEVAL`
- `SOMNI_INCLUDE_RETRIEVAL_DEBUG`

Retrieval inspection note:

- Run `node scripts/verify-stage4-retrieval.mjs` for the focused weak-scenario check.
- Use `SOMNI_LOG_RETRIEVAL=true` for server logs.
- Use `SOMNI_INCLUDE_RETRIEVAL_DEBUG=true` if you want retrieval diagnostics included in the
  `/api/chat` debug payload.

## Local setup

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

These checks currently give the clearest picture of repo health:

```bash
npm test -- --run
npm run build
node scripts/verify-stage4-chat-e2e.mjs
node scripts/verify-stage4-retrieval.mjs
npm run verify:stage5:usage
npm run verify:stage5:stripe
```

## Docs

Start here when orienting yourself:

- `docs/README.md`
- `docs/somni_context.md`
- `docs/somni_architecture.md`
- `docs/somni_implementation_plan_v5.md`
- `docs/somni_ai_quality_hardening.md`

Historical planning and handoff files have been moved to `archive/`.
