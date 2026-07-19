# Somni Pre-Release Checklist

Run this short checklist before merging a major feature or deploying a new build to production.
This checklist assumes caregiver sharing, balanced schedule adaptation, and notifications are active.
If any step fails, do not deploy.

> **Current status (19 July 2026): Stage 7 is complete with a formal No-Go; deployment and any
> external cohort are blocked.** The code, linked-database, Chromium, and AI benchmark gates are
> green, but Stage 6 is reopened because the required operational controls/drills are absent.
> Deployment/schema skew, confirmation-email invite return, resilience/cross-browser evidence,
> actual provider cost, and professional reviews also remain open. See
> `docs/Somni_Launch_Readiness_Report_Alpha_1.2.md`. This checklist does not replace those gates.

## 1. Environment & Config Check
- [ ] `vercel.json` matches intended behavior (e.g., cron jobs are correctly scheduled).
- [ ] Stripe API keys and Webhook secrets are correctly populated in production environment variables.
- [ ] Supabase environment variables are connected.
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are populated in the production environment.
- [ ] `SOMNI_INCLUDE_RETRIEVAL_DEBUG` and `SOMNI_FORCE_BILLING_FAILURE` are unset in production.
- [ ] Secrets are server-only; no service-role, Stripe, VAPID-private, cron, or evaluation secret
  appears in a tracked file or `NEXT_PUBLIC_*` variable.
- [ ] `npx supabase migration list --linked` shows local/linked alignment through
  `20260719130000_sleep_log_idempotency.sql`.
- [ ] `npx supabase db lint --linked` reports no schema or function warnings.
- [ ] Production responses enforce the nonce CSP and security headers described in
  `docs/security_model.md`; local HTTP remains usable without `upgrade-insecure-requests`.

## 2. Fast Build & Lint Check
Run the core static checks locally:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
npm audit --omit=dev
npm run verify:links
python -m unittest discover -s somni_eval -p "test_*.py"
```

Required result: all code checks pass, and there are no unaccepted critical or high production
dependency vulnerabilities.

## 3. Automated Flow Validations (Smoke Tests)
Run deterministic verification from the project root:

```bash
npm run verify:stage7:adaptive

# Verify the LLM chunk retrieval isn't broken
node scripts/verify-stage4-retrieval.mjs

# Verify the evaluation pipeline without calling the app
python somni_eval/run_eval.py --dry-run --max-questions 5
```

Notes:
- `verify:stage7:adaptive` is the required adaptive-plan safety gate before release.
- Use the pre-created test credentials in `docs/TEST_ACCOUNTS.md` for manual verification. Do not create a new user account.
- The old onboarding/chat/usage/Stripe/caregiver scripts were deleted because they created auth
  users or reset linked fixtures too broadly. Do not run restored copies.
- Start the built app with `npm run start`, set `CI=1` and `SOMNI_APP_URL` in the second terminal,
  then run `npx playwright test`. The serial suite uses approved non-production accounts, guarded
  fixture lookup, and exact cleanup; it must report no auth-user creation or deletion.
- AI launch evidence additionally requires an authorised, read-only real benchmark with the same
  untracked `SOMNI_EVAL_SECRET` in the app and runner. Run the 110-question comparable core and
  the seven Stage 7 extensions as described in `somni_eval/README.md`, then grade the results.

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

Current outcome: **not satisfied — No-Go**. Items stay unchecked until a fresh exact-SHA review.

- [ ] Alpha 1.2 Stages 0-6 are complete with passing handoffs (Stage 6 is currently Blocked).
- [ ] The Stage 7 deep-dive report exists and is indexed from `docs/README.md`.
- [ ] Full AI benchmark, performance evidence, and accessibility/security browser results are attached.
- [ ] Backup/restore and deployment rollback drills have timestamped evidence and named owners.
- [ ] Pre-created test credentials are confirmed non-production-only and rotated if reuse or
  production access is possible.
- [ ] Decision is **Go** or approved **Conditional Go**.
- [ ] Conditional-Go cohort, owners, deadlines, monitoring, and stop conditions are recorded.
- [ ] Deployment and rollback owners are available for the observation window.
