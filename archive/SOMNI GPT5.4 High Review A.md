# SOMNI GPT5.4 High Review A

## Purpose

This document captures a high-detail review of Somni based on:

- current source-of-truth documentation
- recent implementation plans
- code inspection
- automated verification
- live environment checks against the connected Supabase, GitHub, and Vercel setup

It is written to help both product decision-making and implementation planning.

---

## Executive Summary

Somni is in a stronger state than many products at this stage.

The good news:

- the core codebase is structured well
- the adaptive sleep-plan system is thoughtful and well tested
- lint, build, unit tests, retrieval checks, and chat end-to-end checks all passed
- local `main`, GitHub `main`, and the latest Vercel production deployment all match the same commit
- billing endpoints responded correctly in live testing

The main concern:

- the support flow is currently broken in the connected environment

There are also a few important quality-control gaps:

- the shared test account is not actually ready for normal signed-in testing
- some current docs disagree with the real implementation
- some verification scripts are unreliable on Windows because they do not shut local servers down cleanly

Overall conclusion:

**Somni's product foundation is promising and the adaptive-plan work is credible, but the project now needs a short quality and reliability pass more than another major feature push.**

---

## Review Scope

### What was checked

- repo sync across local, GitHub, and Vercel
- current docs in `docs/`
- recent implementation plans in `docs/` and `archive/`
- main product areas in code:
  - onboarding
  - dashboard
  - daily plans
  - adaptive plans
  - chat
  - support
  - billing
  - sleep logging
- automated quality checks
- selected live route behavior

### Environments checked

- local repo
- GitHub remote
- Vercel production metadata
- connected Supabase project via the credentials in `.env.local`

---

## Repo And Deployment Parity

### Result

Confirmed.

Local `main`, GitHub `origin/main`, and the latest Vercel production deployment all match:

- commit: `34dea620aaa032f534d1133e55fc5cee93fa6c41`
- commit message: `test: add stage 7 adaptive-plan regression pack`

### Why this matters

This means the code reviewed locally is the same code currently deployed to production.
That reduces ambiguity and makes the findings much more trustworthy.

---

## What Passed

The following checks completed successfully:

- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `node scripts/verify-stage7-adaptive-plans.mjs`
- `node scripts/verify-stage4-retrieval.mjs`
- `node scripts/verify-stage4-chat-e2e.mjs`

### What this tells us

- core code quality is stable
- TypeScript and build integrity are healthy
- adaptive-plan logic has meaningful regression coverage
- retrieval quality checks are in place and passing
- the chat API can complete a real end-to-end flow

This is a strong base.

---

## Main Findings

## 1. Critical Issue: Support Flow Is Broken

### What I found

The support feature currently tries to save support requests into a database table called `support_tickets`.

However, in the connected Supabase environment, that table does not currently exist.

This caused:

- `scripts/verify-stage5-smoke.mjs` to fail
- direct support submission attempts to return `500`
- direct signed-in insert testing to return:
  - `Could not find the table 'public.support_tickets' in the schema cache`

### Why this matters

This is not a cosmetic issue.

It means that if a real user tries to report a bug or ask for help, the support request fails.
That is especially risky in a beta product, because support is meant to be the safety net when something goes wrong.

### Likely cause

One of these is true:

1. the migration for `support_tickets` was created locally but never applied to the connected Supabase project
2. the project is pointed at a Supabase environment that is missing the latest schema
3. the docs and code were updated for the new support design, but the live database was not brought along

### Recommendation

Fix this before shipping more user-facing changes.

---

## 2. High Issue: Support Form UI Will Still Look Broken Even After The Table Exists

### What I found

The support form expects the API to return a support ticket `id`.

But the support API currently returns:

```json
{ "success": true }
```

So even if the insert succeeds, the frontend still interprets that as failure.

### Why this matters

This creates a nasty false-negative experience:

- user clicks send
- backend succeeds
- frontend still shows an error

That damages trust because the user does not know whether their message went through.

### Recommendation

Make the API and UI agree on one response contract.

Best option:

- API should return the created ticket `id`
- UI should show a clear success state using that returned `id`

---

## 3. Medium Issue: The Shared Test Account Is Not Ready For Real Product Testing

### What I found

`docs/TEST_ACCOUNTS.md` presents `agent-test@somni.app` as the standard reusable test user.

But in the connected environment, that user currently has:

- `onboarding_completed = false`
- no baby profile

When I tested signed-in routes with that account, these redirected to `/onboarding`:

- `/dashboard`
- `/chat`
- `/sleep`
- `/billing`

### Why this matters

This makes the manual QA process unreliable.

The docs tell reviewers to use the shared test account for core product checks, but that account cannot currently access the core signed-in product state.

This creates three problems:

- testing becomes slower
- results become less consistent
- people may incorrectly assume a route is broken when the account setup is the real issue

### Recommendation

Create and maintain one properly seeded shared QA account with:

- onboarding completed
- one baby profile
- realistic starting data
- a little sleep log history

That account should be kept stable on purpose.

---

## 4. Medium Issue: Support Documentation Is Out Of Sync

### What I found

The current docs disagree about how support works.

Some docs still describe support as writing to runtime logs.
Other docs describe support as writing to the `support_tickets` table.
The code uses the database table approach.

### Why this matters

When docs drift, people test the wrong thing.

In this case, someone following the wrong document could conclude:

- support is working because they checked logs

when in reality:

- the support submission is failing before any ticket is created

### Recommendation

Unify support documentation immediately after fixing the actual support path.

One support model.
One set of instructions.
One source of truth.

---

## 5. Low-Medium Issue: Retrieval Breadth In Docs And Runtime Do Not Match

### What I found

The architecture docs state that retrieval currently uses 7 chunks.

That is true at the retrieval module default level.

But the actual chat route currently requests retrieval with `limit: 5`.

### Why this matters

This is not catastrophic, but it matters for trust and repeatability.

If a future review compares retrieval behavior to the docs, they may misunderstand the real runtime behavior.

### Recommendation

Pick one and align both:

- either keep 5 and update docs
- or restore chat to 7 if that is still the intended product decision

Because this affects answer grounding and coverage, it should be treated as product behavior, not a minor technical detail.

---

## 6. Low-Medium Issue: Stage 5 Verification Scripts Are Unreliable On Windows

### What I found

The longer Stage 5 verification scripts timed out and left Node processes behind.

The likely reason is that they start local servers with:

- `shell: true`

but later stop them with only:

- `serverProcess.kill("SIGTERM")`

That cleanup is not robust on Windows.

Notably, another script in the repo already uses a safer Windows-specific process-tree shutdown pattern.

### Why this matters

Quality gates are only valuable if people can trust and run them consistently.

Right now:

- some checks pass
- some checks hang
- some leave local machines messy

That discourages regular verification.

### Recommendation

Refactor the test scripts to use one shared helper for:

- env loading
- temp server startup
- readiness waiting
- safe shutdown on Windows

---

## 7. Product Copy Still Has A Few “Too Corporate” Areas

### What I found

The later UI plans aimed to make Somni feel calmer, warmer, and less corporate.

A lot of that work has landed well.

However, the daily plan panel still includes copy like:

- “This is the shared plan Somni is keeping in sync for [babyName] today.”

That wording feels more internal and system-oriented than parent-oriented.

### Why this matters

For a tired, non-technical parent, small wording choices strongly affect trust.

The best version of Somni should feel like:

- calm
- practical
- personal

not:

- technical
- process-heavy
- platform-like

### Recommendation

Do a small product-copy pass on the dashboard and support areas after the reliability fixes.

---

## What Looks Strong

## 1. Adaptive Plan System

This is the strongest part of the product from an implementation point of view.

The adaptive plan architecture cleanly separates:

- the durable baseline plan
- today-only rescue changes
- explainability history

That is a smart design decision.

Why it is good:

- it avoids confusing “temporary fix” with “long-term learning”
- it makes the product easier to trust
- it gives you room to improve adaptation safely later

This is exactly the kind of product logic that should live in code, not just in prompts.

## 2. Verification Culture

Even though some scripts need cleanup, the project already has a much better verification habit than most early apps.

There are real checks for:

- unit logic
- retrieval quality
- adaptive plan scenarios
- chat end-to-end behavior

That is a serious strength and worth protecting.

## 3. Architecture Shape

The codebase is reasonably clean and understandable.

Main product areas are separated in a sensible way:

- app routes
- components
- lib logic
- scripts
- Supabase migrations

This should make future improvements easier than if the app had grown in a more tangled way.

## 4. Billing Surface

The live billing endpoints I checked responded correctly:

- checkout returned a Stripe Checkout URL
- portal returned a Stripe billing portal URL

That does not guarantee every billing scenario is perfect, but it is a good sign that the basics are wired correctly.

---

## Product-Level Interpretation

If I translate the review into plain business/product language:

### Current state

Somni feels like a real product, not just a prototype.

The adaptive planning concept is meaningful and differentiated.
The AI layer is more disciplined than average.
The technical base is decent.

### Main risk right now

The main risk is not “the AI is bad.”

The main risk is:

- reliability gaps
- support failure
- test setup drift
- docs drift

In other words:

**the product idea is ahead of the operational quality controls.**

That is normal at this stage, but it should now be corrected deliberately.

---

## Recommended Implementation Plan

## Phase 1: Reliability And Truth Pass

### Goal

Fix anything that makes the app appear unreliable or harder to trust.

### Tasks

1. Fix support database parity
   - apply or repair the `support_tickets` migration in the connected Supabase project
   - confirm table, indexes, RLS, and trigger exist in the live environment

2. Fix support API and form contract
   - return the inserted ticket `id` from `/api/support`
   - make frontend success handling match the API response
   - verify signed-in support submission works end to end

3. Fix the shared QA account
   - complete onboarding
   - create one baby
   - seed a small realistic dataset
   - re-check all signed-in pages using that exact shared account

4. Align support docs
   - update all current docs to reflect the database-backed support workflow
   - remove old references to runtime-log support handling from current docs

### Quality gates

- support submission succeeds from the real UI
- support ticket row appears in `support_tickets`
- frontend shows a clear success state
- shared QA account can access `/dashboard`, `/chat`, `/sleep`, and `/billing`
- `scripts/verify-stage5-smoke.mjs` passes
- docs all agree on support behavior

---

## Phase 2: Verification System Hardening

### Goal

Make the quality gates dependable enough that the team will actually keep using them.

### Tasks

1. Refactor shared test helpers
   - server startup
   - readiness polling
   - Windows-safe shutdown
   - auth cookie construction
   - temp-user cleanup

2. Repair hanging Stage 5 scripts
   - `verify-stage5-usage-limit.mjs`
   - `verify-stage5-stripe.mjs`

3. Review which tests truly need live external services
   - keep live checks where valuable
   - reduce unnecessary flakiness where possible

4. Decide a stable release gate set
   - “always run”
   - “run when AI changes”
   - “run before release”

### Quality gates

- Stage 5 scripts complete without hanging
- no orphaned Node processes remain after script completion
- scripts pass on Windows in the same environment used for day-to-day work
- release checklist only references tests that are actually practical to run

---

## Phase 3: Docs Source-Of-Truth Cleanup

### Goal

Bring docs back into full alignment with the real app.

### Tasks

1. Align support docs
2. Align retrieval-limit docs
3. Check env-var docs against real code usage
4. Confirm release checklist and verification checklist match current behavior
5. Confirm “current” docs stay in `docs/` and only superseded material stays in `archive/`

### Quality gates

- no major contradictions between current docs and code
- one clear support model in docs
- one clear retrieval behavior statement in docs
- one clear QA account description in docs

---

## Phase 4: Product Polish Pass

### Goal

Improve perceived product quality without changing major logic.

### Tasks

1. Review parent-facing copy in:
   - dashboard
   - plan panel
   - support page
   - chat confirmations

2. Remove remaining internal/system-sounding phrases

3. Re-check mobile readability on:
   - dashboard
   - chat
   - sleep log
   - support

### Quality gates

- copy feels calm, clear, and non-technical
- no obviously corporate/system-heavy wording remains in primary parent surfaces
- mobile layouts remain clean and readable

---

## Suggested Execution Order

Recommended order:

1. Fix support path
2. Fix shared QA account
3. Repair Stage 5 scripts
4. Align docs
5. Do product copy polish

Reason:

- support is the most urgent real failure
- QA account and scripts affect the quality of every future review
- docs should be corrected after the real implementation is corrected
- copy polish should come after the trust-critical fixes

---

## Recommended Quality Control Gates

## Gate A: Core Static Integrity

Run every time:

```bash
npm run lint
npm test -- --run
npm run build
```

Pass standard:

- all 3 must pass

## Gate B: Adaptive Plan Safety

Run after plan, onboarding, or dashboard logic changes:

```bash
node scripts/verify-stage7-adaptive-plans.mjs
```

Pass standard:

- script completes cleanly

## Gate C: AI Grounding Safety

Run after prompt, retrieval, or corpus changes:

```bash
node scripts/verify-stage4-retrieval.mjs
node scripts/verify-stage4-chat-e2e.mjs
```

Pass standard:

- retrieval check passes
- chat end-to-end passes
- source attribution still exists
- emergency redirect still works

## Gate D: Product Smoke

Run before release:

```bash
node scripts/verify-stage5-smoke.mjs
```

Pass standard:

- dashboard loads
- chat works
- sleep logging works
- support works

## Gate E: Billing Smoke

Run before release if billing code changed:

```bash
npm run verify:stage5:stripe
```

Pass standard:

- checkout route works
- portal route works
- webhook sync works

## Gate F: Usage Limit Smoke

Run before release if quota or subscription logic changed:

```bash
npm run verify:stage5:usage
```

Pass standard:

- free limit behavior is correct
- premium bypass is correct

## Gate G: Manual Product Sanity Check

Run using the shared seeded QA account:

1. Open `/dashboard`
2. Open `/chat`
3. Open `/sleep`
4. Open `/support`
5. Submit one support request
6. Confirm billing page opens properly

Pass standard:

- no unexpected redirects
- no obvious broken UI
- support submission succeeds

---

## Concrete Next Steps

## Immediate next step

Create one short implementation task focused only on support reliability:

### Support Reliability Task

Scope:

- verify and apply `support_tickets` migration in the connected Supabase project
- update `/api/support` to return the created ticket id
- update the support form success handling
- update support docs
- re-run smoke verification

Required quality gates:

```bash
npm run lint
npm test -- --run
npm run build
node scripts/verify-stage5-smoke.mjs
```

Manual checks:

- submit support request from signed-in UI
- verify row exists in `support_tickets`
- verify success state is shown to the user

## Second next step

Create a QA setup task:

### Shared QA Account Task

Scope:

- repair `agent-test@somni.app`
- complete onboarding
- add one baby
- seed small useful sample data
- update `docs/TEST_ACCOUNTS.md` with the actual expected account state

Required quality gates:

- shared account opens `/dashboard`, `/chat`, `/sleep`, `/billing`
- manual sanity pass completes without forced onboarding

## Third next step

Create a verification-hygiene task:

### Script Reliability Task

Scope:

- refactor Stage 5 scripts to use shared helpers
- fix Windows cleanup
- remove hanging behavior

Required quality gates:

- `npm run verify:stage5:usage` completes
- `npm run verify:stage5:stripe` completes
- no orphaned Node processes remain

---

## Final Assessment

Somni is not in a bad state.
It is in a **promising but slightly uneven** state.

The core product work is ahead of the surrounding operational polish.

That is actually a good problem to have, because:

- it is easier to harden a good product foundation than to rescue a weak one

My recommendation is clear:

**pause major new feature work briefly and do one focused reliability and truth pass first.**

That should concentrate on:

- support working for real
- test setup being trustworthy
- scripts being dependable
- docs matching the app

Once that is done, Somni will be in a much better position to keep building without accumulating confusion or trust damage.

---

## Appendix: Review Snapshot

### Confirmed healthy

- local, GitHub, and Vercel parity
- lint
- tests
- build
- adaptive-plan verification
- retrieval verification
- chat end-to-end verification
- billing checkout route
- billing portal route

### Confirmed broken or unreliable

- support submission path
- support frontend success handling
- shared test account readiness
- support documentation consistency
- Stage 5 script reliability on Windows

### Overall priority

1. Fix support
2. Fix test account
3. Fix verification scripts
4. Fix docs drift
5. Do copy polish
