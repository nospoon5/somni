# Somni Verification Checklist

Use this after normal product changes. Keep it lightweight and consistent.

## 1) Automated checks

Run from project root:

```bash
node scripts/verify-stage7-adaptive-plans.mjs
npm run lint
npm test -- --run
npm run build
node scripts/verify-stage4-retrieval.mjs
```

Expected result:

- All five commands pass with no errors.
- Stage 7 adaptive verification covers:
  - onboarding/profile bootstrap anchors and confidence behavior
  - dashboard source selection (saved vs profile-derived vs age fallback)
  - chat daily rescue vs durable baseline signals
  - log-driven hold vs baseline-shift decisions (including rough-patch holds)

AI-focused follow-up when retrieval or prompt logic changed:

```bash
node scripts/verify-stage4-chat-e2e.mjs
```

Expected result:

- Normal chat still includes source attribution.
- Emergency prompts still trigger the safety redirect.
- Retrieval diagnostics are available in debug mode.
- Same-day rescue chat changes stay framed as today's plan only.
- Explicit ongoing parent statements can update the learned baseline without pretending sparse logs are proof.

Notification-focused follow-up when sleep actions, caregiver access, profile settings, or the service worker changed:

1. Use two linked accounts from `docs/TEST_ACCOUNTS.md` in separate browser sessions.
2. Confirm a sleep start or completion creates a feed row and delivers an allowed browser push to the other caregiver.
3. Enable quiet hours and repeat; the feed row should still appear while the browser push is suppressed.
4. Confirm the bell unread count increments and **Mark all as read** returns it to zero.

## 2) Fast product sanity check

Use the pre-created account in `docs/TEST_ACCOUNTS.md` (do not create a new user).

1. Open one core signed-in page (for example `/dashboard`) and then go to `/support`.
2. Confirm the support form field **Where this happened** shows the original page, not `/support`.
3. Submit a support request and verify runtime logs include:
- `origin_page` with the real problem page
- `support_page` with `/support...`

## 3) Docs drift check

Quickly confirm:

- `docs/somni_architecture.md` matches routes and env vars used in code.
- `vercel.json` cron schedule and docs agree.
- Superseded notes stay in `archive/` instead of current docs.
