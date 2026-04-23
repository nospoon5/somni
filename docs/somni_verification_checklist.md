# Somni Verification Checklist

Use this after normal product changes. Keep it lightweight and consistent.

## 1) Automated checks

Run from project root:

```bash
npm run lint
npm test -- --run
npm run build
node scripts/verify-stage4-retrieval.mjs
```

Expected result:

- All four commands pass with no errors.

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

## 2) Fast product sanity check

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
