# Somni - Implementation Plan v2

Audit date: 2026-04-03

This document replaces the earlier implementation plan as the current working source of truth.

## Stage A Follow-up - 2026-04-04

This follow-up reflects a fresh local, browser, database, and Vercel re-check.

New verified facts from 2026-04-04:

- Local `npm run lint` passes.
- Local `npm run build` passes.
- Local Stage 4 chat e2e verification still passes.
- Local Stage 5 usage-limit verification still passes.
- Live sign-up reaches `/onboarding` in a real browser.
- Live sign-in to a seeded account reaches `/dashboard` in a real browser.
- Live `/dashboard` loads for a signed-in seeded account in a real browser.
- Live `/sleep` loads for a signed-in seeded account in a real browser.
- Live sleep start and end actions both returned `200` in Vercel runtime logs during browser testing, and the resulting sleep row was confirmed in the database.
- Live `/chat` was failing earlier in the day on production with `Missing Supabase admin environment variables`, but that specific blocker was cleared after the Vercel production env was updated and production was redeployed.
- The latest verified production deployment after that env change is still built from commit `f9e1271`.
- Live `/chat` now loads for an authenticated user in a real browser.
- Live emergency chat returned `200` from `/api/chat` on the production deployment in a browser-backed test.
- Live sign-up, onboarding completion, and first dashboard load were re-verified end-to-end in a fresh production browser run.
- The fresh production sign-up created the expected `profiles`, `babies`, and `onboarding_preferences` rows in the same Supabase project used by the audited local environment.
- No local-only Stage A product-code fix remains after the 2026-04-04 re-check. The live recovery was achieved by the Vercel env fix and redeploy on commit `f9e1271`.

## Stage B Follow-up - 2026-04-04

This follow-up reflects a fresh Stage B local, browser, Vercel, and API re-check.

New verified facts from 2026-04-04:

- Local `main` and `origin/main` are both at commit `254b7e7`.
- The latest verified production deployment is `dpl_8wSb2o5V6bXyha7qc5bvauhsbQN2`, built from commit `254b7e7`.
- Local `node scripts/verify-stage4-chat-e2e.mjs` passes.
- `supabase/migrations/20260403_add_corpus_match_function.sql` is now applied in the intended Supabase project `glcrmmenotezedcmrwni`.
- The remote `public.match_corpus_chunks` function now exists in the intended Supabase project.
- Local `node scripts/verify-stage4-retrieval.mjs` now reports RPC mode against the intended Supabase project.
- Live normal chat is currently broken for non-emergency use on production.
- In a direct authenticated live call to `/api/chat`, production returns HTTP `200` but streams an SSE `error` event with detail `Missing GEMINI_API_KEY for retrieval embedding`.
- In a real production browser run, the same live normal chat failure appears as the generic UI message `Something went wrong while generating advice. Please try again in a moment.`
- Live capped free-user state is verified in a real production browser run.
- The live capped state shows the daily-limit explanation, used count, reset time, and upgrade buttons.
- In that same live browser run, the upgrade buttons are visibly disabled and the page states `Billing buttons will start working once Stripe is connected in the app environment.`
- Direct authenticated live calls confirm `/api/billing/checkout` returns `503` with `Stripe checkout is not configured yet.`
- Direct authenticated live calls confirm `/api/billing/portal` returns `503` with `Stripe billing is not configured yet.`
- The intended Supabase project ref used by the audited local env is `glcrmmenotezedcmrwni`.

## Stage B Completion Follow-up - 2026-04-04

This follow-up reflects the final Stage B production re-check after the chat truncation fix was pushed from commit `c389cf8`.

New verified facts from the final 2026-04-04 re-check:

- Live normal chat now returns a complete non-emergency response on production.
- A direct authenticated live call to `/api/chat` returned `200` and a complete response of about 2357 streamed characters, ending cleanly rather than mid-sentence.
- The production truncation bug was caused by Gemini 2.5 Flash spending output budget on thinking tokens, and the pushed fix sets `thinkingBudget: 0` for this chat flow.
- Live checkout entry now returns `200` and a real `checkout.stripe.com` URL.
- Live checkout entry still persists a `stripe_customer_id` for the authenticated user.
- Live portal entry now returns `200` and a real `billing.stripe.com` URL.
- In a production browser run after promoting a temporary user to premium state, the chat page shows both `Somni Premium` and `Manage billing`.
- Stage B exit criteria are now met.

Still unverified or only partially verified as of 2026-04-04:

- The exact Vercel `SUPABASE_SERVICE_ROLE_KEY` value was not read back directly from Vercel in this audit. Correct project targeting is inferred from the successful live chat recovery and matching production database writes, not from direct env inspection.
- The exact production values of `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, and `STRIPE_PRICE_ANNUAL` were not read back directly from Vercel in this audit. Their current production state is inferred from verified runtime and route behaviour, not from direct env inspection.
- No remote `supabase_migrations.schema_migrations` table was found in the audited project during this Stage B pass, so migration-history parity with the repo remains unverified even though the retrieval RPC itself is now verified live in the database.

## Evidence Standard

- Verified: directly tested during this audit.
- Inferred: supported by code inspection, but not proven end-to-end in this audit.
- Unverified: attempted or claimed elsewhere, but not proven in this audit.

## Verified Current Status Summary

Somni is materially built, Stage A remains closed, and Stage B is now verified on the live deployment.

What is solid:

- The latest verified production deployment now reflects the reviewed Stage C wording pass on `somni-six.vercel.app`.
- Local `npm run lint` passes.
- Local `npm run build` passes.
- Local core product flows work in the audited environment: auth redirects, dashboard load, sleep start/end, emergency chat handling, free-tier limit UI, and PWA registration basics.
- Local Stage 4 and Stage 5 verification scripts pass.
- Live sign-up, onboarding completion, sign-in, dashboard access, sleep start/end, chat, capped-state billing prompts, checkout entry, and portal entry have now been re-verified on 2026-04-04 with browser and database evidence.

What is not yet safe to call complete:

- Stage C wording is now live on the production alias, but Stage D launch sign-off still has broader QA and hardening work left.

## Verified Completed Work

Only items below were directly verified in this audit.

- Verified: the production alias now serves the reviewed Stage C copy after redeploy.
- Verified: landing page, login page, signup page, onboarding page, dashboard page, sleep page, chat page, legal pages, manifest route, and service worker route exist in the built app.
- Verified: unauthenticated requests to `/dashboard`, `/sleep`, and `/chat` redirect to `/login` locally.
- Verified: unauthenticated requests to `/dashboard`, `/sleep`, and `/chat` redirect to `/login` on the live deployment.
- Verified: local signed-in dashboard loads for a seeded user.
- Verified: local sleep flow can start and end a sleep session in the browser.
- Verified: local emergency chat flow returns the emergency-safe response in the browser.
- Verified: local daily limit UI appears after a capped chat request and shows upgrade buttons.
- Verified: local manifest loads and a service worker registration is created in the browser.
- Verified: `20260403_add_corpus_match_function.sql` is applied in the intended Supabase project.
- Verified: local Stage 4 retrieval verification script now reports RPC mode against the intended Supabase project.
- Verified: local Stage 4 chat e2e verification script passes.
- Verified: local Stage 5 usage-limit verification script passes.
- Verified: local Stage 5 Stripe verification script passes.
- Verified: live public routes `/privacy`, `/terms`, `/disclaimer`, `/manifest.webmanifest`, and `/sw.js` return `200`.
- Verified: live sign-up can complete onboarding and land on `/dashboard` in a fresh browser run.
- Verified: that fresh live onboarding run created matching `profiles`, `babies`, and `onboarding_preferences` rows in the audited Supabase project.
- Verified: live `/chat` loads and live emergency chat returns a successful response after the Vercel production env fix and redeploy.
- Verified: live normal chat returns a complete non-emergency response after the truncation fix.
- Verified: live capped free-user UI shows the limit explanation, reset time, and upgrade buttons in a real browser.
- Verified: live checkout entry returns a real Stripe Checkout URL.
- Verified: live portal entry returns a real Stripe billing portal URL.
- Verified: premium billing UI now shows `Somni Premium` and `Manage billing` in a real production browser run.
- Verified locally: the homepage, legal pages, README, handoff, and context docs have been rewritten to remove draft/placeholder trust wording.

## Stage C Live Verification - 2026-04-04

This update reflects the Stage C wording pass after production redeploy.

New verified facts from 2026-04-04:

- The production alias `somni-six.vercel.app` now serves the reviewed Stage C homepage, privacy, terms, disclaimer, footer, metadata, and manifest wording.
- The homepage preview now labels itself as an illustration instead of implying live score data.
- The privacy, terms, and disclaimer pages no longer present themselves as draft placeholders.
- The live footer now includes the Australia `000` emergency note.
- The README, architect handoff, and product context docs describe the real app and current environment expectations.

## Incomplete Work By Priority

### P0 - Required before any real beta traffic

1. No open Stage A P0 remains after the 2026-04-04 production re-check.
   Production chat, live sign-up, live sign-in, dashboard, and sleep are now all verified on the live deployment.

### P2 - Required before launch trust claims

7. Keep README, plan docs, and handoff docs synced with the deployed release.
8. Run a focused release-readiness QA pass across local and live with evidence captured.

### P3 - Hardening and cleanup

10. Add a database-level guard against multiple active sleep sessions for one baby.
11. Reduce chat-page coupling to admin-only setup work so missing billing config cannot take down the whole page.
12. Clean up low-value script warnings and small UX rough edges.

## Important Risks And Technical Debt

### Production safety

- Low risk: Stage B production chat and billing entry paths are now verified live.

### Correctness

- Low risk: retrieval is now running through the intended pgvector RPC path in the audited Supabase project.
- Medium risk: sleep logging only prevents duplicate active sessions in application code, not at the database level.

### Maintainability

- Medium risk: `ChatPage` performs admin-backed subscription bootstrap during page render, which widens the blast radius of missing env vars.
- Medium risk: verification coverage is mostly ad hoc scripts rather than a repeatable browser suite checked into the repo.
- Low risk: the Stage C docs now match the current repo better, but they still need a live deployment pass to be fully complete.

### Trust and compliance

- High risk for launch: the live deployment still shows the older draft legal copy until the Stage C wording is redeployed.
- Medium risk: the docs needed a substantial trust/readiness refresh, but the local repo now has the reviewed wording in place.

## Suggested Refactors

These are recommended improvements, but they are not the first thing to do.

### Beneficial refactors

- Refactor subscription loading so `/chat` can render in a safe read-only mode even if billing bootstrap fails. This is now an optional hardening task, not a Stage A blocker.
- Move quota and entitlement writes behind explicit server-side operations that do not require page-render side effects.
- Add a partial unique database rule for one active `sleep_logs` row per baby.
- Replace ad hoc verification scripts with a small committed browser regression pack for auth, sleep, chat, and billing entry points.

### Refactors to avoid right now

- Do not add a large profile/settings subsystem.
- Do not add a dedicated billing page unless the embedded billing entry point proves inadequate.
- Do not expand into feeding, partner sharing, predictive scheduling, notifications, or native apps during this recovery phase.

## New Stage Structure

## Stage A - Production Recovery And Parity

Goal:
Make the deployed product truthful, usable, and debuggable again.

Required work:

- Add the missing Supabase admin configuration to Vercel production.
- Confirm which Supabase project the live deployment is using.
- Re-test live sign-up, sign-in, dashboard, sleep, and chat with evidence.
- Confirm the latest production deployment is still on the intended commit after redeploy.

Quality gates:

- Live `/chat` loads for an authenticated user without a server error.
- Live sign-in and sign-up each complete successfully at least once during the audit pass.
- Vercel runtime logs show no fresh `/chat` `500` errors during the verification window.
- Local and live auth/data writes are confirmed against the intended environment, and service-role parity is strongly supported by the successful live recovery.

Stage exit criteria:

- A signed-in user can reach `/dashboard`, `/sleep`, and `/chat` on the live deployment.
- No open P0 production blocker remains.

## Stage B - Retrieval And Billing Truth Pass

Goal:
Prove that chat and monetisation work through their intended production paths, not only fallbacks or local scripts.

Required work:

- Apply `20260403_add_corpus_match_function.sql` to the intended Supabase environment.
- Re-run retrieval verification and confirm it reports RPC mode, not fallback mode.
- Browser-test the capped chat state and upgrade path.
- Browser-test checkout entry and portal entry on the deployed app.
- Re-check webhook-driven entitlement sync after deployment recovery.

Quality gates:

- Retrieval verification reports RPC mode.
- Live capped-user UI clearly explains the limit and the reset time.
- Checkout and portal entry points both work from the live deployment.
- Stored subscription state changes are reflected correctly in the live app.

Stage exit criteria:

- Chat is no longer dependent on fallback retrieval for the intended environment.
- Billing can be described as live-verified, not just locally scripted.

## Stage C - Launch Trust And Content Readiness

Goal:
Make the product honest enough to put in front of real parents.

Required work:

- Replace draft legal copy with reviewed final copy.
- Update README, plan docs, and handoff docs so they match reality.
- Review offline wording, install wording, and safety wording for accuracy.
- Complete a calm, mobile-first copy pass to remove any remaining rough edges.

Quality gates:

- Legal pages no longer say draft or placeholder.
- README explains the real project, environment expectations, and verification commands.
- No product page makes a claim that is not currently true.
- Safety and emergency wording is visible and consistent.

Stage exit criteria:

- The product is legally and operationally honest.
- New contributors can orient themselves from the docs without guessing.

## Stage D - Beta Readiness Sign-Off

Goal:
Close the last operational gaps before inviting external testers.

Required work:

- Run one full local QA pass and one full live QA pass.
- Check Vercel runtime logs after that pass.
- Confirm rollback path, support contact, and bug triage process.
- Document known limitations that remain acceptable for beta.

Quality gates:

- No blocking issue remains in auth, onboarding, dashboard, sleep, chat, or billing entry.
- Runtime logs stay clear during the final walkthrough.
- Known limitations are documented and intentionally accepted.

Stage exit criteria:

- Somni is safe to describe as beta-ready.

## Short Practical Next Actions

1. Redeploy the reviewed Stage C wording.
2. Browser-check the live homepage and legal pages to confirm the draft language is gone.
3. Keep the README and handoff docs aligned with the current deployed release.
4. Keep retrieval and billing proof current by re-running the existing verification checks after any future environment or deployment change.

## What Should Stay Out Of Scope

Keep these out of the current execution plan unless the product vision changes:

- Native iOS or Android apps
- Push notifications
- Feeding tracking
- Partner sharing
- Multi-baby-first redesign
- Predictive schedule generation
- Any broad feature expansion beyond infant sleep coaching, logging, chat, billing, and trust/readiness work

## Audit Notes

- Local verification was materially stronger than live verification in this audit.
- Production chat failure was the clearest blocker earlier in the audit, but it is now resolved on the live deployment.
- This v2 plan intentionally favours recovery, parity, and honesty over new feature work.
