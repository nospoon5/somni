# Deployment and Rollback Runbook

This document defines the intended release path for the Next.js application and Supabase
migrations. External project settings must be checked at release time; repository files alone do
not prove that Vercel production deployment, branch protection, previews, or notifications are
configured.

> **Stage 7 status — release automation and rollback evidence are unverified (19 July 2026):** The
> application builds for Vercel and the repository contains Supabase migrations, but the Stage 7
> audit has not demonstrated a production deployment, an instant code rollback, a database restore,
> or an alert/communications path. There is no implemented maintenance mode or `#ops-alerts`
> integration. A successful rollback rehearsal and named release/response coverage are required
> before launch.

## 1. Confirm the actual deployment path

Before a release, an authorised operator must verify and record:

- which Git repository and branch the Vercel production project uses;
- whether pushes or merges to `main` deploy automatically;
- whether preview deployments are created and what database/environment they use;
- which Supabase project is linked by the CLI;
- who can deploy, promote, or roll back; and
- where build/runtime failures are observed and how the responder is contacted.

Do not infer any of these controls from this runbook. In particular, a preview must not be allowed to
mutate production fixtures merely because it has production-like environment variables.

## 2. Pre-deployment gates

Run the repository's current quality gates from the project root:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
npm audit --omit=dev
npm run verify:links
node scripts/verify-stage7-adaptive-plans.mjs
node scripts/verify-stage4-retrieval.mjs
```

Run the Playwright matrix separately with the pre-created accounts in `docs/TEST_ACCOUNTS.md`.
Never sign up a test user. The linked-fixture safety guard requires explicit approved environment
values; review the exact cleanup scope before enabling mutation and never aim the suite at an
unauthorised remote or production target.

Do not deploy when a required gate fails, an unexplained working-tree change is present, a secret is
staged, or the Stage 7 decision does not permit the intended cohort.

## 3. Database migration order

Classify every release as code-only, backward-compatible schema change, or destructive schema/data
change.

- Additive changes should be applied before code begins relying on them.
- Code should stop using a column or behaviour before a later migration removes it.
- Destructive or data-rewriting migrations require a tested recovery plan, explicit approval, and
  verified backup evidence. Do not treat a Git revert as a database rollback.

Before applying a linked migration:

```bash
npx supabase migration list --linked
```

Confirm the displayed project is the intended environment and review every pending migration. Apply
only after that check:

```bash
npx supabase db push --linked
```

Record the migration list before and after. Never use a destructive reset command against a linked
hosted project.

## 4. Deploy and observe

1. Record the commit, migration versions, target environment, and Stage 7/cohort authorisation.
2. Apply approved backward-compatible migrations in the reviewed order.
3. Deploy the exact reviewed commit through the verified Vercel path.
4. Confirm the build completes and the production URL serves that commit.
5. Use only the pre-created test accounts to smoke-test login, dashboard, chat safety, sleep logging,
   caregiver isolation, support, and any changed billing path. Do not create users or complete a
   live charge as an incidental smoke test.
6. Review Vercel runtime logs, Supabase logs, Stripe webhook deliveries when relevant, and support
   submissions for new errors.
7. Keep a named responder available for the agreed observation window. Fifteen minutes may be a
   useful minimum for immediate failures, but it is not evidence that delayed cron, webhook, email,
   or retention behaviour is healthy.

## 5. Code rollback

If the release causes a SEV-1/SEV-2 or fails smoke testing:

1. Stop further releases and record the decision time.
2. In Vercel, select the last deployment whose commit and schema compatibility are known. Use the
   provider's current rollback or promotion control only after confirming the target.
3. Verify the production URL serves the intended prior commit.
4. Repeat the critical smoke flow and inspect runtime/provider logs.
5. Record rollback duration, result, and any residual data impact.

This procedure is **unproven until rehearsed**. Dashboard labels and behaviour can change, so the
actual control must be verified before launch.

## 6. Database recovery

Prefer leaving a backward-compatible additive schema in place while code is rolled back. If a
migration corrupted or deleted data, follow [Backup and Restore](backup_restore_runbook.md). A
production restore is a SEV-1 operation with an explicit data-loss decision; do not attempt an
ad-hoc down migration.

## 7. Release evidence

Keep a private release record containing the commit, migration versions, gate results, deploy time,
smoke results, log-review window, incidents, rollback target, and actual responsible people. Do not
include credentials, test-account passwords, raw chat, baby data, or provider secrets.
