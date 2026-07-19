# Somni Verification Checklist

Use this after normal product changes. Keep it lightweight and consistent.

The live programme and stage-specific gates are in
`docs/Somni_Implementation_Plan_Alpha_1.2.md`. This checklist is the reusable core, not proof of
launch readiness.

## 1) Automated checks

Run from project root:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
npm audit --omit=dev
npm run verify:stage7:adaptive
node scripts/verify-stage4-retrieval.mjs
npm run verify:links
```

Expected result:

- All eight commands pass with no errors or unexplained warnings.
- Stage 7 adaptive verification covers:
  - onboarding/profile bootstrap anchors and confidence behavior
  - dashboard source selection (saved vs profile-derived vs age fallback)
  - chat daily rescue vs durable baseline signals
  - log-driven hold vs baseline-shift decisions (including rough-patch holds)

AI-focused follow-up when retrieval, prompt, response filtering, or the evaluation transport
changed:

```bash
npx vitest run src/lib/ai src/app/api/chat
python -m unittest discover -s somni_eval -p "test_*.py"
python somni_eval/run_eval.py --dry-run --max-questions 5
```

Expected result:

- Unit tests cover source attribution, urgent and emergency redirects, response filtering,
  prompt injection boundaries, evaluation authorization, and chat-plan persistence.
- The dry run verifies the evaluation CSV, adapter, and resume pipeline without calling the app.
- A real evaluation run additionally requires the same untracked `SOMNI_EVAL_SECRET` (at least
  32 characters) in the app and runner environments. Evaluation mode is read-only and does not
  consume quota or persist benchmark messages.

The old onboarding, chat, Stripe, usage-limit, caregiver-sharing, and evaluation rerun scripts
were removed because they created temporary auth users or changed linked fixtures too broadly.
Do not restore or run copies of them. Browser coverage now lives in `tests/e2e/` and uses only the
approved accounts from `docs/TEST_ACCOUNTS.md`, guarded fixture lookup, and exact row cleanup.

For a release candidate, build and start the production server in one terminal:

```powershell
npm run build
npm run start
```

Then run the serial browser matrix in another PowerShell terminal:

```powershell
$env:CI = '1'
$env:SOMNI_APP_URL = 'http://127.0.0.1:3000'
npx playwright test
```

Run this only against the approved non-production Supabase test project. Expect no auth-user
creation or deletion; the suite may create narrowly tagged rows and must remove those exact rows.

Notification-focused follow-up when sleep actions, caregiver access, profile settings, or the service worker changed:

1. Use two linked accounts from `docs/TEST_ACCOUNTS.md` in separate browser sessions.
2. Confirm a sleep start or completion creates a feed row and delivers an allowed browser push to the other caregiver.
3. Enable quiet hours and repeat; the feed row should still appear while the browser push is suppressed.
4. Confirm the bell unread count increments and **Mark all as read** returns it to zero.

## 2) Fast product sanity check

Use the pre-created account in `docs/TEST_ACCOUNTS.md` (do not create a new user).

1. Open one core signed-in page (for example `/dashboard`) and then go to `/support`.
2. Confirm the support form field **Where this happened** shows the original page, not `/support`.
3. Submit a support request and confirm the UI reports success.
4. As an authorised admin, confirm exactly one new `support_tickets` row contains:
   - `origin_page` with the real problem page;
   - `support_page` with `/support...`;
   - the expected signed-in profile relationship.
5. Confirm a normal user cannot list or read support tickets.

The 17 July returning-row defect is resolved. The insert no longer requests a row that normal-user
RLS cannot read, and the five-per-hour rate check uses a server-only admin client and fails closed
when it cannot establish the count. Keep the checks above because they prove the repair without
broadening normal-user ticket access.

## 3) Docs drift check

Quickly confirm:

- `docs/somni_architecture.md` matches routes and env vars used in code.
- `docs/Somni_Implementation_Plan_Alpha_1.2.md` reflects current stage status and handoff evidence.
- `vercel.json` cron schedule and docs agree.
- Superseded notes stay in `archive/` instead of current docs.
- Current Markdown links resolve and no current doc points to an archived plan as live work.
- The linked migration list matches local files through
  `20260719130000_sleep_log_idempotency.sql`.
