# Somni Verification Checklist

Use this after normal product changes. Keep it lightweight and consistent.

## 1) Automated checks

Run from project root:

```bash
npm run lint
npm test -- --run
npm run build
```

Expected result:

- All three commands pass with no errors.

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
