# Somni Pre-Release Checklist

Run this short checklist before merging a major feature or deploying a new build to production.
This checklist assumes caregiver sharing, balanced schedule adaptation, and notifications are active.
If any step fails, do not deploy.

## 1. Environment & Config Check
- [ ] `vercel.json` matches intended behavior (e.g., cron jobs are correctly scheduled).
- [ ] Stripe API keys and Webhook secrets are correctly populated in production environment variables.
- [ ] Supabase environment variables are connected.
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are populated in the production environment.
- [ ] Apply any new SQL migration files to production Supabase.

## 2. Fast Build & Lint Check
Run the core static checks locally:

```bash
npm run lint
npm run build
```

## 3. Automated Flow Validations (Smoke Tests)
Run the automated verification scripts against either your local instance or a staging preview:

```bash
# Stage 7 adaptive-plan regression pack (fast)
node scripts/verify-stage7-adaptive-plans.mjs

# Verify the LLM chunk retrieval isn't broken
node scripts/verify-stage4-retrieval.mjs

# Verify critical user flows (Sign in, Dashboard, Chat, Logging, Support)
node scripts/verify-stage5-smoke.mjs
```

Notes:
- `verify-stage7-adaptive-plans` is the required adaptive-plan safety gate before release.
- Use the pre-created test credentials in `docs/TEST_ACCOUNTS.md` for manual verification. Do not create a new user account.

## 4. Manual Verification (Only if the code touches these)
If the upcoming release modifies these flows, perform a manual click-test via the UI:

- **Dashboard**: Does the sleep score correctly display when data is sparse vs. populated?
- **Adaptive Plans**: Confirm same-day rescue changes stay day-only, while explicit ongoing statements update the learned baseline.
- **Schedule Rescue**: Log a wake at least 20 minutes from baseline, confirm the pending damped schedule appears, then test both accept and dismiss.
- **Caregiver Push**: With two pre-created caregiver accounts, confirm a sleep event creates a feed row and an allowed browser push for the other caregiver.
- **Quiet Hours**: Repeat inside the recipient's suppression window; confirm the feed row remains but no browser push is delivered.
- **Notification Bell**: Confirm the unread count increments and **Mark all as read** returns it to zero.
- **Billing**: Can you click "Upgrade" and reach the Stripe checkout portal?
- **Support Form**: Can you submit a short message and see the structured request in runtime logs?
