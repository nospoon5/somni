# Somni Pre-Release Checklist

Run this short checklist before merging a major feature or deploying a new build to production. 
If any step fails, do not deploy.

## 1. Environment & Config Check
- [ ] `vercel.json` matches intended behavior (e.g., cron jobs are correctly scheduled).
- [ ] Stripe API keys and Webhook secrets are correctly populated in production environment variables.
- [ ] Supabase environment variables are connected.

## 2. Fast Build & Lint Check
Run the core static checks locally:

```bash
npm run lint
npm run build
```

## 3. Automated Flow Validations (Smoke Tests)
Run the automated verification scripts against either your local instance or a staging preview:

```bash
# Verify the LLM chunk retrieval isn't broken
node scripts/verify-stage4-retrieval.mjs

# Verify critical user flows (Sign in, Dashboard, Chat, Logging, Support)
node scripts/verify-stage5-smoke.mjs
```

## 4. Manual Verification (Only if the code touches these)
If the upcoming release modifies these flows, perform a manual click-test via the UI:

- **Dashboard**: Does the sleep score correctly display when data is sparse vs. populated?
- **Billing**: Can you click "Upgrade" and reach the Stripe checkout portal?
- **Support Form**: Can you send a short message and see it in the Supabase `support_tickets` table?
