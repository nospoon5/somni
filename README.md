# Somni

Somni is a sleep coaching app for parents of babies and young children. It uses
Supabase for auth and data, Gemini for chat and retrieval, and Stripe for paid
billing.

## What this repo contains

- Public marketing pages at `/`
- Email/password auth at `/login` and `/signup`
- Onboarding, dashboard, sleep logging, and chat flows
- Legal pages at `/privacy`, `/terms`, and `/disclaimer`
- Route handlers for chat, sleep, scoring, and billing

## Environment

The app expects these core environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `CRON_SECRET` (required for `/api/cron/memory-backfill` scheduled job auth)
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `STRIPE_WEBHOOK_SECRET`

Optional tuning variables:
- `AI_MEMORY_SYNC_BUDGET_MS` (default `1200`, max wait before falling back to async memory write)
- `AI_MEMORY_BACKFILL_BABY_LIMIT` (default `50`)
- `AI_MEMORY_BACKFILL_MESSAGE_LIMIT` (default `8`)

The code falls back to sensible defaults in a few places, but the app is only
fully functional when the matching production services are configured.

## Local setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Verification

Useful checks for this repo:

```bash
npm run lint
npm run build
node scripts/verify-stage4-chat-e2e.mjs
node scripts/verify-stage4-retrieval.mjs
npm run verify:stage5:usage
npm run verify:stage5:stripe
```

## Notes

- The app uses the Next.js App Router.
- Public copy and legal wording are kept intentionally plain and specific.
- If you change routing, metadata, or route handlers, read the matching guide in
  `node_modules/next/dist/docs/` first.
