# Somni Pre-Release Checklist

Run this short checklist before merging a major feature or deploying a new build to production.
This checklist assumes caregiver sharing, balanced schedule adaptation, and notifications are active.
If any step fails, do not deploy.

> **Current status (17 July 2026): Launch blocked.** The confirmed blockers and their exit
> criteria are in `docs/Somni_Implementation_Plan_Alpha_1.2.md`. This checklist does not replace
> the Alpha 1.2 stage gates. A public launch requires the Stage 7 Go decision or an explicitly
> approved Conditional Go with cohort limits and stop conditions.

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
npx tsc --noEmit
npm test -- --run
npm run build
npm audit --omit=dev
```

Required result: all code checks pass, and there are no unaccepted critical or high production
dependency vulnerabilities.

## 3. Automated Flow Validations (Smoke Tests)
Run the automated verification scripts against either your local instance or a staging preview:

```bash
# Stage 7 adaptive-plan regression pack (fast)
node scripts/verify-stage7-adaptive-plans.mjs

# Verify the LLM chunk retrieval isn't broken
node scripts/verify-stage4-retrieval.mjs
```

Notes:
- `verify-stage7-adaptive-plans` is the required adaptive-plan safety gate before release.
- Use the pre-created test credentials in `docs/TEST_ACCOUNTS.md` for manual verification. Do not create a new user account.
- Do not use `verify-stage5-smoke.mjs`, the old chat/usage/Stripe E2E scripts, onboarding smoke,
  or caregiver-sharing script as routine release gates until Alpha 1.2 S0.10/S1.5 removes their
  temporary-user creation. The safe replacement suite must be added here when complete.

## 4. Manual Verification (Only if the code touches these)
If the upcoming release modifies these flows, perform a manual click-test via the UI:

- **Dashboard**: Does the sleep score correctly display when data is sparse vs. populated?
- **Adaptive Plans**: Confirm same-day rescue changes stay day-only, while explicit ongoing statements update the learned baseline.
- **Schedule Rescue**: Log a wake at least 20 minutes from baseline, confirm the pending damped schedule appears, then test both accept and dismiss.
- **Caregiver Push**: With two pre-created caregiver accounts, confirm a sleep event creates a feed row and an allowed browser push for the other caregiver.
- **Quiet Hours**: Repeat inside the recipient's suppression window; confirm the feed row remains but no browser push is delivered.
- **Notification Bell**: Confirm the unread count increments and **Mark all as read** returns it to zero.
- **Billing**: Can you click "Upgrade" and reach the Stripe checkout portal?
- **Navigation**: Can a first-time tester find settings, billing, support, and sign-out?
- **Invitations**: Can a signed-out invitee sign in and return to the same valid invitation? Do
  wrong-account, expired, revoked, and tampered invitations fail safely?
- **Concurrent Sleep End**: From two caregiver sessions, does exactly one completion win and
  produce exactly one set of downstream notifications/adaptation work?
- **Support Form**: Can a signed-in user submit once, see success, and produce exactly one
  `support_tickets` row that normal users cannot list?
- **Error Recovery**: Do primary routes show deliberate loading and non-sensitive recovery UI?

## 5. Launch Decision Evidence

- [ ] Alpha 1.2 Stages 0–6 are complete with passing handoffs.
- [ ] Stage 7 deep-dive report is linked here: ____________________
- [ ] Decision is **Go** or approved **Conditional Go**.
- [ ] Conditional-Go cohort, owners, deadlines, monitoring, and stop conditions are recorded.
- [ ] Deployment and rollback owners are available for the observation window.
