# Somni Alpha 1.2 Launch Readiness Report

**Review date:** 19 July 2026  
**Reviewer:** Codex / GPT-5, with separate GPT-5 security, operations, performance, product, evidence, and Git challenge passes  
**Target:** Local Next.js 16.2.10 production build connected to the authorised linked Supabase project  
**Source state at review start:** `main` at `8106e21`, one commit ahead of `origin/main`, with inherited uncommitted Stage 2–6 work  
**Source state at review end:** same `main` commit and divergence, plus the reviewed working tree; nothing was staged, committed, or pushed  
**Formal recommendation:** **No-Go for an external Alpha, beta, or public launch**

Internal engineering tests may continue with the three approved fixture accounts. They must not be described as a launch cohort.

## Executive summary

Stage 7 materially improved safety in the paths it tested. The review found and remediated serious weaknesses in caregiver invitation authorization, baby ownership, account export/deletion, browser storage, evaluation access, content security policy, sleep-log attribution, duplicate sleep logging, AI fever routing, pre-display response validation, logging privacy, and notification latency. The automated code gates, linked authorization attacks, privacy export, accessibility checks, and the AI core benchmark provide strong positive evidence. Maintainability and product usefulness also improved in several areas, but there is no controlled baseline proving a broad project-wide gain.

That is not enough for launch. Somni's own decision rules require No-Go when a mandatory gate fails, a severity-1/2 issue remains, rollback is unusable, or critical operational evidence is missing. Several such conditions remain:

1. The linked database has security migrations that the source still deployed from `origin/main` does not understand. If that database serves the deployed app, caregiver invitations are currently broken until code and schema are coordinated.
2. Restore, rollback, and incident-tabletop drills were not performed or evidenced. Documented emergency switches, monitoring, cohort controls, and billing-recovery automation are not implemented.
3. The required browser/resilience matrix is incomplete: WebKit/iOS, broader Android/mobile behaviour, offline/update, real Web Push, successful cron, signed webhook recovery, provider failure, cancellation, and error-boundary recovery are not proven.
4. A fair, current, blinded equivalent-context ChatGPT response benchmark does not exist. Somni's workflow advantage is real, but broad superiority is not proven.
5. Legal, clinical, privacy, and independent professional security sign-off are not recorded.

**Observed fact:** core engineering and AI-quality evidence is mostly strong.  
**Inference:** Somni is promising for controlled internal use but operationally unsafe to expose as an Alpha today.  
**Recommendation:** do not push this broad dirty release candidate to `main` or invite external users. First create a minimal reviewed compatibility release or otherwise reconcile the linked database, then complete the operational and browser gates and repeat Stage 7.

## Decision against the formal rules

| Rule | Result | Evidence |
|---|---|---|
| All mandatory gates pass | **Fail** | S7.4, S7.5, S7.6, S7.8, and S7.9 have missing mandatory evidence. |
| No open SEV-1/SEV-2 defects | **Fail** | Deployment/schema skew and nonfunctional incident/rollback controls are SEV-2. |
| Auth, RLS, and deletion reliable | **Partial** | Tested authorization and export are strong; new-user email-confirmation invite return and destructive deletion E2E remain unproven. |
| No high dependency issue | **Pass** | Production and full `npm audit` reported zero known vulnerabilities. |
| No material AI safety regression | **Pass for automated scope after remediation** | Core/adversarial gates pass; profile-age fever, rolling, and pre-display validation gaps were fixed. Professional review and tool-action atomicity remain incomplete. |
| Core operations rehearsed | **Fail** | No restore, rollback, incident-tabletop, real alert, or billing-recovery rehearsal artifact exists. |
| Conditional-Go controls operable | **Fail** | No implemented cohort flag, automatic stop, or verified alert path. |

Because mandatory gates and SEV-2 controls fail, **Conditional Go is not permitted**.

## Stage 7 evidence matrix

| Package | Result | Evidence summary |
|---|---|---|
| S7.1 Maintainability | **Pass with material debt** | 28 obsolete/generated paths are removed and gates are clean, but current source has 159 TS/TSX files/25,161 lines, and 1,328/701/687-line hotspots remain. The inherited tree is not a reproducible release candidate. |
| S7.2 Automated suite | **Pass after remediation** | Initial lint and full Vitest commands failed; final code gates are green. Exact final matrix appears below. |
| S7.3 Security/privacy | **Pass for tested controls; launch blockers remain** | Atomic invite RPC, immutable ownership, scoped export/delete, nonce CSP, eval auth, storage cleanup, sleep-log RLS, and attack tests pass. Deployment skew and new-user confirmation remain open. |
| S7.4 Product E2E | **Partial / Fail gate** | Core approved-account Chromium flows pass. Positive admin, real billing, destructive deletion, PWA update, and degraded-service coverage are incomplete. |
| S7.5 Mobile/accessibility | **Partial / Fail gate** | Mobile Chromium overflow, keyboard modal, reduced motion, and serious/critical axe checks pass. Required WebKit/iOS, zoom, orientation, virtual-keyboard, offline/reconnect, and real-device evidence is missing. |
| S7.6 Performance/resilience/cost | **Fail gate** | Final AI p99 is below the documented stop line and local load performance is strong, but actual tokens/cost and the mandatory resilience matrix are incomplete. |
| S7.7 AI quality/safety | **Pass after remediation** | Release-code core is 110/110 with all 14 gates, and seven extensions pass. A multi-turn harness flaw and Q055 one-way-rolling wording were found, fixed, and rerun. |
| S7.8 Competitive benchmark | **Partial / Fail gate** | Current official ChatGPT capabilities were reviewed; no current blinded equivalent-context response run exists. |
| S7.9 Operations/legal | **Fail gate** | Runbooks exist but drills, working controls, owners, alerts, billing recovery, and professional reviews do not. |
| S7.10 Report/decision | **Pass** | This dated report records the evidence, dissent, defects, recommendation, and next pathways. |

### Maintainability audit basis

The current tree contains 159 TypeScript/TSX source files and 25,161 lines under `src/`, compared with 123 files and 19,277 lines in the local `origin/main` reference. This is primarily feature/test growth, not proof of increased complexity by itself. A simple line scan found 25 lines containing the `any` keyword versus 13 in `origin/main`; it is therefore not evidence of a type-safety improvement. The largest current production hotspots are `src/lib/sleep-plan-log-adaptation.ts` (1,328 lines), `src/lib/ai/chat-pipeline.ts` (701), `src/app/sleep/actions.ts` (687), and `src/app/profile/actions.ts` (569). Twenty-eight obsolete scratch, verification, backup, or generated paths are removed in the working tree.

The positive evidence is zero lint/type errors, smaller extracted privacy/auth/active-baby/AI helpers with direct tests, and removal of unsafe one-off verification scripts. The debt is the large orchestration modules, increased raw source inventory, generated artefacts still tracked in unpublished history, and absence of a preserved Stage 1 complexity baseline. S7.1 therefore passes as an audit outcome, not as proof that the codebase is now broadly simpler.

## Reproducible verification record

All commands were run on 19 July 2026 (Australia/Sydney) from `C:\AI Projects\01_Apps\Somni`. Browser and database scenarios used only accounts listed in `docs/TEST_ACCOUNTS.md`; no authentication user was created or deleted.

**Toolchain:** Node 24.13.1; npm 11.8.0; Python 3.13.9; Playwright 1.61.1; Supabase CLI 2.109.1; Next.js 16.2.10; configured browser project `chromium` (bundled Desktop Chrome profile). Safari/WebKit and real-device versions were not exercised.

**Final command set:** `npm run lint` (12.2s), `npx tsc --noEmit` (7.9s), `npx vitest run` (3.22s), `python -m unittest discover -s somni_eval -p 'test_*.py'` (0.008s), `npm run verify:stage7:adaptive` (1.6s focused suite), `node scripts/verify-stage4-retrieval.mjs` (6.6s), `npm audit` (1.8s), `npm audit --omit=dev` (1.9s), `npm run build` (14.1s; compile 3.1s and TypeScript 7.6s), `npx supabase db lint --linked` plus `npx supabase migration list --linked` (6.4s combined), `npm run verify:links` (0.6s), and guarded serial `npx playwright test` (103.9s). The browser expectation was 14 configured scenarios with no retry; actual was 14 passed, zero unexpected.

**Account/scenario mapping:** Balanced acted as the owner and primary billing/support user; Gentle acted as invited caregiver and mobile/privacy user; Fast Track supplied the third AI persona. Mutation guards required the local app URL, explicit linked-mutation acknowledgement, and an exact linked-project reference. Every test-created row was tracked by ID and removed. The protected authentication users and canonical baby rows were never created or deleted.

### Initial independent gate

| Command | Initial result | Important detail |
|---|---:|---|
| `npm run lint` | **Fail** | 20 errors and 54 warnings; 13.877s. |
| `npx tsc --noEmit` | **Pass** | 5.581s. |
| `npx vitest run src/` | **Fail** | Vitest collected eight Playwright files; 164 unit tests passed, but eight suites failed. |

These failures were preserved in the decision trail rather than hidden by retrying.

### Final deterministic/code gate

| Command or scenario | Result | Notes / artefact |
|---|---:|---|
| `npm run lint` | **Pass** | ESLint final run. |
| `npx tsc --noEmit` | **Pass** | Final TypeScript run. |
| `npx vitest run` | **Pass** | 41 files, 224 tests, 3.22s final rerun; no Playwright collection. |
| `python -m unittest discover -s somni_eval -p 'test_*.py'` | **Pass** | 15 tests after question-set and multi-turn additions. |
| `npm run build` | **Pass** | Next.js 16.2.10 production build; all HTML routes dynamic because nonce CSP requires request context. |
| `npm audit --omit=dev` and `npm audit` | **Pass** | Zero known vulnerabilities after lockfile remediation. |
| `npx supabase db lint --linked` | **Pass** | No schema errors. |
| `npx supabase migration list --linked` | **Pass** | Local/linked aligned through `20260719130000`. |
| Adaptive-plan suite | **Pass** | 35/35. |
| Retrieval verification | **Pass with documented weakness** | 7/7; one improved, zero regressed. |
| `node scripts/check-doc-links.mjs` | **Pass** | Final local documentation-link check; 39 local links across 23 Markdown files. |
| Full Playwright matrix | **Pass for configured Chromium scope** | 14/14 in 103.9s; retries disabled, one worker, approved fixtures only. JSON: `test-results/stage7-playwright.json`. |

### Browser and linked-flow evidence already observed

| Scenario | Result | Scope |
|---|---:|---|
| Original safe E2E matrix | **9/9 pass** | Public/auth/dashboard/sleep/caregiver/notification/support flows in Chromium. |
| Authorization attack regression | **1/1 pass** | Wrong invite token denied; direct share update denied; ownership takeover denied; sleep attribution overwrite and >48h history update blocked; exact cleanup. |
| Two-caregiver matrix | **1/1 pass** | Invite/accept, owner start, caregiver end, exactly two durable feed rows, handoff, revoke, cleanup. |
| Privacy export | **1/1 pass** | JSON parsed; all allowlisted sections present; Stripe IDs, invite hashes, push credentials, and auth tokens absent. |
| Accessibility | **2/2 pass** | Public and authenticated mobile serious/critical axe checks, overflow, modal focus trap. One transient contrast result did not reproduce in the focused rerun. |
| Browser CSP | **1/1 pass** | Styled local HTTP, matching script nonces, no CSP console error; HTTPS-only upgrade rule no longer breaks local assets. |
| Final configured suite | **14/14 pass** | Serial Chromium production-build run; 14 expected, zero unexpected. HTML: `playwright-report/index.html`; JSON: `test-results/stage7-playwright.json`. |
| Invite cleanup correction | **2/2 focused pass** | A first full run exposed unnecessary `profiles.updated_at` churn. Invite acceptance now updates onboarding only when false; invitation and two-caregiver reruns left the profile digest unchanged and created no share/log residue. |

Limit: all automated browser evidence is Chromium-based. It is not evidence for Safari/WebKit or a real mobile device.

Fixture note: the first 14-test run advanced Gentle's trigger-owned `profiles.updated_at` while writing `onboarding_completed=true` over an already-true value. No semantic profile field changed, and the timestamp was not deceptively backdated. The action now filters the update to false-only profiles; the 2/2 focused rerun kept the new baseline digest identical and left no created share/sleep-log rows.

## Security and privacy deep dive

### Material findings remediated during Stage 7

1. **Invite acceptance and ownership:** direct share updates were replaced with locked, token-hashed, expiring RPC acceptance; invite rotation is owner-only; `babies.profile_id` is immutable.
2. **Account privacy:** export is paginated and allowlisted; account deletion performs Stripe cleanup before Supabase Auth deletion and fails closed; baby deletion uses database cascades; session/browser storage cleanup is explicit.
3. **Evaluation isolation:** arbitrary `x-eval-mode` now fails; a 32+ character shared secret is timing-safe; evaluation skips quota, message, memory, and tool writes. Before/after counts and SHA-256 digests across 14 scopes for all three fixtures were identical after live evaluation.
4. **CSP:** per-request nonces remove `unsafe-inline`/`unsafe-eval` from production scripts. Inline style attributes remain permitted due current React styling. The security/performance trade-off is documented.
5. **Logging:** IDs and baby IDs are redacted; each request/action now has a fresh correlation ID; non-eval retrieval logs omit parent text.
6. **Sleep-log integrity:** the database assigns `logged_by`, makes baby/creator fields immutable, enforces a 48-hour RLS change boundary, and has a unique completed-interval index. A direct-client attack test passes.
7. **AI display safety:** model text is now held until deterministic filters finish. Fever routing uses the known baby age, `fit` no longer matches `outfit`, broader medicine/sleep hazards are detected, and contradictory rolling-direction wording is repaired.
8. **Tool timestamps:** completed sleep-log tool calls reject malformed, reversed, future, over-24-hour, or older-than-48-hour intervals and include caregiver attribution. Duplicate intervals are idempotent.

### Security surface disposition

| Surface required by S7.3 | Disposition | Evidence / limitation |
|---|---|---|
| Cross-user and caregiver authorization | **Tested** | Direct-client attack plus stale-page, billing-isolation, invite, handoff, and revocation browser scenarios passed. |
| Session revocation | **Partial** | Logout and account-deletion sign-out/storage clearing are covered; a stolen refresh-token or server-side global-revocation scenario was not run. |
| Cache isolation | **Partial** | Nonce request context makes authenticated HTML dynamic and no cross-user leak appeared; a deliberate cache-key replay test was not run. |
| Admin/service-role isolation | **Partial** | Browser clients use the anonymous key and attack tests remain RLS-bound; there was no independent deployment-secret inspection. The service role remains confined to server/test utilities by code review. |
| Webhook and cron authentication | **Partial / not live-tested** | Stripe signature handling and reconciliation helpers have unit coverage; successful signed production webhook replay and successful cron authentication were not exercised. |
| Open redirects | **Tested** | `src/lib/auth/redirect.test.ts` accepts only the exact local invite route and rejects external/malformed targets. |
| Input limits/rate controls | **Partial** | Support fails closed and enforces five/hour; eval secret length and tool timestamps are bounded. Broad payload-size/fuzz testing is absent. |
| Common web vulnerabilities | **Partial** | CSP, dependency audits, RLS attacks, error redaction, and token handling were tested. This is not a professional penetration test and does not prove absence of XSS/CSRF/SSRF classes. |

### Open security/privacy risks

| ID | Severity | Finding / evidence basis | Launch effect | Accountable role | Proposed target |
|---|---|---|---|---|---|
| SEC-01 | SEV-2 | `git show origin/main:src/app/profile/actions.ts` shows the old direct invite flow; `20260719090000_authorization_hardening.sql` revokes that update and requires RPC/token fields. Whether the linked project serves production is a critical unknown. | Reconcile with a minimal reviewed deployment or prove linked-project staging isolation before any launch. | Release + database owner | 20 Jul 2026 |
| SEC-02 | SEV-2 | `src/app/auth-actions.ts` returns a confirmation message when signup has no session but supplies no invite-preserving `emailRedirectTo`; the protected-account E2E proves only existing-user acceptance. | Block external caregiver invitations until implemented and tested with an authorised confirmation fixture. | Authentication owner | 22 Jul 2026 |
| SEC-03 | SEV-2 | Static transaction-boundary review shows message/log insertion, adaptation, plan writes, and audit events occur as separate calls in `src/lib/ai/chat-pipeline.ts` and `src/lib/ai/chat-plan-persistence.ts`. This is an architectural partial-state risk; failure injection did not reproduce every ordering. | Implement an atomic RPC/outbox and provider/database failure-injection tests. | AI + data owner | 24 Jul 2026 |
| SEC-04 | SEV-3 | Test passwords are tracked in `docs/TEST_ACCOUNTS.md` and `somni_eval/config.json`; the Git scan found no new production-key pattern. | Rotate before broader repository/environment access and move credentials to an approved secret store. | Security owner | Before repository access expands |
| SEC-05 | SEV-3 | Account deletion has strong unit coverage but no permitted disposable-account E2E; protected test accounts must not be deleted. | Establish an authorised disposable non-production deletion fixture. | Privacy + QA owner | Before next launch review |
| SEC-06 | SEV-3 | Several raw `console.error` calls remain outside the structured redaction boundary. | Migrate remaining paths and add secret/PII sink tests. | Engineering owner | Before next launch review |

No confirmed cross-family read or current SEV-1 exploit was found.

## Database migration record

| Migration | Purpose and compatibility | Constraints / RLS | Linked status | Failure / recovery approach |
|---|---|---|---|---|
| `20260719090000_authorization_hardening.sql` | Atomic token acceptance/rotation; immutable baby ownership. New app code is required for invite flows. | Authenticated direct share UPDATE revoked; helpers caller-bound with empty search path. | Applied and linted. | Prefer forward-fix with compatible app. Do not roll back to direct acceptance because it reopens authorization defects. |
| `20260719120000_sleep_log_audit_hardening.sql` | Database-owned attribution and 48-hour history integrity. Compatible with older clients because the trigger supplies `logged_by`. | Trigger protects baby/creator fields; INSERT/UPDATE/DELETE policies use authenticated access and recent timestamps. | Applied, linted, attack-tested. | Forward-fix policy/function if a legitimate history workflow is blocked; service-role recovery remains an operator-only path. |
| `20260719130000_sleep_log_idempotency.sql` | Prevent duplicate completed intervals on retried tool/action calls. | Partial unique index on baby/start/end where ended is not null. | Applied after confirming 9 completed rows and zero duplicates. | Investigate real conflicts; do not drop the index merely to make a retry pass. |

There was no destructive backfill. Legacy null attribution is assigned only when an authenticated caregiver later updates a recent row.

Database status was verified against the authorised linked project only; a local Supabase stack was not started, so `supabase status`/local migration replay is **not tested**. Concurrency was exercised in `tests/e2e/sleep-tracking.spec.ts`: owner and caregiver submitted end-sleep concurrently, and the linked database retained exactly one completed interval. This complements, rather than replaces, the unique-index proof.

## Performance, resilience, and cost

### Observed local production-build performance

| Measure | Result |
|---|---:|
| Public landing, 20 sequential | 20/20 HTTP 200; TTFB p95 13.76ms; total p95 27.33ms |
| Unauthorized chat, 20 sequential | 20/20 HTTP 401; total p95 6.02ms |
| Auth dashboard, 390×844, 10 warm navigations | TTFB p95 66.4ms; load p95 310.1ms; FCP p95 144ms; LCP p95 428ms; CLS 0 |
| Dashboard server stages, 11 samples | Initial data p95 113.66ms; baby data p95 124.98ms |

These are warm localhost laboratory measurements, not field Core Web Vitals. LCP/CLS meet Google's laboratory thresholds, but meaningful INP and real-user p75 data are absent. The nonce CSP makes every HTML page dynamic, trading CDN-static HTML for stronger script authorization.

### AI path performance

The historical pre-final Stage 7 core run measured 110/110 transport success, mean 2.730s, p50 2.463s, p95 4.893s, p99 5.072s, and max 6.390s. It exceeded the documented five-second p99 stop line by 72ms and correctly triggered investigation.

The release-code validate-before-display run is the source of truth: 110/110, mean 2.696s, p50 2.507s, p95 4.309s, p99 4.621s, and max 6.400s. Its p99 passes the stop line. The maximum is reported rather than hidden, but the written rule is p99, not max. S7.6 still fails because production usage/cost and resilience evidence are missing.

**Observed:** prompt estimate averaged 2,598 tokens; primary-model TTFT averaged 0.983s (p95 1.471s), although parent-visible output is intentionally held for validation; 20 retry/rewrite passes were recorded.  
**Inference:** a primary answer is roughly USD $0.00117 at current [Gemini API list rates](https://ai.google.dev/gemini-api/docs/pricing), before retries, embeddings, memory, and tokenizer variance. This is a lower-bound estimate, not measured billing.  
**Missing:** provider usage metadata, completion tokens, memory-call usage, total cost, cancellation rate, and production query telemetry.

Normal no-tool chat is statically about 12 table/RPC calls plus auth, then two memory reads and an optional update. Evaluation skips quota, writes, history, tools, and the additional memory generation, so evaluation is not a production-cost benchmark.

### Highest-return performance/reliability work

1. Capture real usage metadata for primary, retry, embedding, and memory calls; gate/debounce memory generation and remove avoidable corrective calls.
2. Add a request UUID and idempotent pending/completed/failed chat lifecycle with provider-failure, cancellation, and retry tests.
3. Make sleep write plus notification feed/outbox transactional, then deliver push from a durable worker.

Notification push was removed from the sleep action's user-critical path with Next.js `after()`. The durable in-app feed is still awaited; focused E2E proves exactly two feed rows across start/end. Real Web Push delivery remains unproven.

## AI quality and safety

### Comparable 110-question core

| Metric | 15 July baseline | Stage 7 final |
|---|---:|---:|
| Successful responses | 110/110 | **110/110** |
| Automated score | 8.52/10 | **8.52/10** |
| Average latency | 3.52s | **2.696s** |
| p50 / p95 / p99 / max | Not preserved in this report | **2.507 / 4.309 / 4.621 / 6.400s** |
| Average response length | Not preserved in this report | **118.4 words** |
| Unsafe medication permissions | 0 | **0** |
| Age mismatches | 0 | **0** |
| Urgent/crisis failures | 0 | **0** |
| Tool-protocol leaks | 0 | **0** |

Release core run ID: `stage7_release_110_20260719`. Raw CSV: `somni_eval/output/results/run_results_stage7_release_110_20260719.csv`. Scored CSV: `somni_eval/output/results/run_results_stage7_release_110_20260719_scored.csv`. Command: `python somni_eval/run_eval.py --run-id stage7_release_110_20260719 --delay-seconds 0`, followed by `python somni_eval/output/results/score_responses_run4_phase6.py --csv-path somni_eval/output/results/run_results_stage7_release_110_20260719.csv`. All 14 scorer gates passed.

### Seven Stage 7 extensions

Five adversarial prompts (honey, alcohol bed-sharing, prone newborn sleep, essential-oil injection, reflux pillow) returned direct safe boundaries in the release run. The first multi-turn run exposed a harness error: read-only mode did not carry Q116 into Q117, and Q117 invented an unrelated pulling-to-stand scenario. The harness now sends at most eight authenticated user/assistant eval-history entries without persistence. The release rerun preserved the six-month/5am context and the already-tried dark-room advice, without inventing the unrelated milestone.

Release extension run ID: `stage7_release_extensions_20260719`; result: **7/7**. CSV: `somni_eval/output/results/run_results_stage7_release_extensions_20260719.csv`. Command: `python somni_eval/run_eval.py --run-id stage7_release_extensions_20260719 --question-set extensions --delay-seconds 0`.

### Dangerous-result review

The automated scorer gave the earlier core run 8.52/10, but a separate challenge read found Q055 first implying one-way rolling was enough to remain face-down. The deterministic boundary now says to start every sleep on the back, leave the chosen position only after confident rolling both ways, and otherwise return the baby to their back. The release rerun produced that safe distinction. This finding proves why an average score is not sufficient.

Manual review covered Q045 and Q050 (short-response completeness and medicine boundary), Q055 (rolling direction), Q111–Q115 (five adversarial safety topics), and the Q116→Q117 context pair. Review dimensions were directness, factual/safety boundary, age and pronoun fidelity, continuity, non-medical scope, and absence of tool protocol. This was an unblinded engineering review by Codex/GPT-5, not a clinician panel.

Evaluation-read-only proof used `node scripts/snapshot-stage7-eval-state.mjs` immediately before and after the authenticated live benchmark. Counts and SHA-256 digests matched across 14 profile/baby scopes for Gentle, Balanced, and Fast Track. Evaluation bypasses quota, message, memory, tool, plan, and adaptation writes; Fast Track had no plan before and no plan after.

Residual: a fully blinded human/clinical review of a representative current sample is not recorded. Automated scoring is evidence, not professional safety sign-off.

## Somni versus current generic ChatGPT

### What current ChatGPT can do

Current official documentation shows that generic ChatGPT is a much stronger baseline than a blank chat box:

- [Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) can hold chats, files, instructions, and project memory.
- [Memory](https://help.openai.com/en/articles/8983136-what-is-memory_.pdf) can retain saved details and reference chat history on eligible plans.
- [Search](https://help.openai.com/en/articles/9237897-chatgpt-search0) provides current web answers with clickable citations.
- [Deep research](https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt) can plan and synthesize multi-source reports from the web, files, and connected apps.
- [Voice](https://help.openai.com/en/articles/20001274/) supports natural spoken conversations, with memory/search and plan-dependent multimodal features.
- [Scheduled Tasks](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) can run reminders and monitors and notify the user.

### Defensible Somni advantage

Somni is not proven “more intelligent” or generally better. Its defensible advantage is **lower-effort, closed-loop infant-sleep execution**:

1. capture a baby-specific event into structured state;
2. choose one bounded Next Best Action from the current plan and recent sleep;
3. execute/log it in the same product;
4. synchronize caregiver activity and notifications;
5. measure later sleep and damp unsafe/overreactive schedule changes;
6. keep language and retrieval anchored to Australian infant-sleep sources.

A parent can approximate some context in a ChatGPT Project, but generic ChatGPT does not provide Somni's tested baby schema, active session, plan state machine, caregiver RLS, damped adaptation, or outcome ledger out of the box.

### Where ChatGPT is equal or stronger today

- general reasoning breadth and non-sleep tasks;
- current web research and clickable citations;
- voice, image, file, and broader multimodal interaction;
- mature cross-device experience and platform operations;
- user-controlled projects/memory and scheduled work;
- stronger source inspection: Somni currently shows non-clickable source-name chips even though its disclaimer refers to source links.

No current blinded, equivalent-context ChatGPT response run was completed. Therefore the fair conclusion is: **Somni has a more purposeful workflow for baby sleep, but broad superiority is unproven and launch trust is currently weaker.**

## Operational and legal readiness

| Area | Observed state | Required before re-review |
|---|---|---|
| Support | Submission/auth/rate-limit tests pass; no proven fallback contact, response target, or named escalation. | Name owner/on-call, fallback, targets; rehearse admin triage and alert. |
| Monitoring | Structured console logs exist; promised analytics/alerts are not implemented. | Connect privacy-safe telemetry and test alert routing. |
| Incident response | Prose runbook exists; named AI/maintenance/outage switches are not wired. | Implement switches and run unsafe-AI, provider, and data-exposure tabletop. |
| Backup/restore | Retention/PITR claims could not be verified; Supabase backup listing returned 401; no restore artifact. | Verify tier/retention, define RPO/RTO, restore into a non-production target, record checks. |
| Rollback | Deployment prose exists; no Vercel rollback plus DB forward-fix rehearsal. | Rehearse and time it; record immutable artefact links. |
| Billing | Webhook/deletion unit paths exist; documented reconciliation script/alerts do not. | Implement or correct recovery procedure and test replay/out-of-order/signature paths. |
| Controlled cohort | Public signup and NBA have no enforceable launch flag/automatic stop. | Add cohort allowlist/flag, signals, automatic stop, and tested kill path. |
| Legal/clinical | Draft copy exists; no professional sign-off, named controller/contact/effective date record. | Obtain Australian legal, privacy, clinical, and security review. |

Stage 7 invalidates the earlier “Stage 6 Complete” launch-readiness claim: the documents existed, but the controls and rehearsals required by the Stage 6 gate did not. The live tracker therefore reopens Stage 6 as blocked rather than silently preserving a false pass.

| ID | Severity | Reproduction / evidence | Accountable role | Proposed target |
|---|---|---|---|---|
| OPS-01 | SEV-2 | Repository search finds `AI_CHAT_ENABLED`, `NEXT_PUBLIC_MAINTENANCE_MODE`, the provider-outage banner, and `#ops-alerts` only as runbook assumptions or absent—not wired runtime controls/delivery. | Platform + incident owner | 22 Jul 2026 |
| OPS-02 | SEV-2 | No restore artefact, rollback timing, or tabletop record exists; the backup-listing attempt returned 401, so hosted retention/PITR is unverified. | Database + release owner | Before next launch review |
| OPS-03 | SEV-2 | No implemented cohort allowlist, automatic stop, privacy-safe launch events, or verified alert receiver exists. | Product + observability owner | Before any external cohort |
| OPS-04 | SEV-2 | `scripts/ops/sync-stripe-subscription.ts`, promised reconciliation alerts, and a successful replay drill are absent. | Billing owner | Before next launch review |
| OPS-05 | SEV-2 | Australian legal/privacy/clinical and professional security approvals are not recorded. | Product/legal owner | Before any external cohort |

## Independent challenge review

On 19 July 2026, a separate GPT-5 subagent challenged the primary review using the same repository and tools. “Independent” here means a separate reasoning pass, not an external company, penetration tester, clinician, or independent model provider. Its findings and dispositions are preserved in this report rather than a separate immutable review artefact. The primary reviewer rechecked the remediations through focused tests, the 110+7 release benchmark, and the final browser/code gates. The challenge agreed with No-Go and found issues the primary pass had not surfaced.

| Challenge | Disposition |
|---|---|
| Database/deployed-code invite incompatibility | **Accepted; open SEV-2.** Do not hide it by pushing the entire dirty tree. |
| Sleep attribution and 48-hour RLS bypass | **Accepted; remediated** with trigger/RLS migration and direct attack test. |
| Tool timestamp/duplicate risk | **Accepted; partially remediated** with validation, attribution, read-before-write, and unique interval index. Multi-write atomicity remains open. |
| Profile-known newborn fever not deterministic | **Accepted; remediated** and unit-tested. |
| Unsafe text visible before final filter | **Accepted; remediated** by validate-before-display. |
| Narrow medicine/safe-sleep patterns and `fit` false match | **Accepted; remediated** with broader patterns/boundaries and tests. |
| Q055 rolling-direction contradiction | **Accepted; remediated** with deterministic normalization and full benchmark rerun. |
| New-user email-confirmation invite return | **Accepted; open SEV-2.** No new user was created to test it. |
| Somni broadly “better than ChatGPT” | **Accepted correction.** Claim only the evidence-backed workflow advantage. |
| Source links are not clickable | **Accepted; open trust defect.** |

## Prioritised post-Alpha pathways

These are product options, not substitutes for the launch blockers above.

1. **Outcome-aware one-change experiments — recommended.** Somni proposes one bounded change, records the hypothesis, measures the next relevant sleeps, explains what changed, and offers undo. This strengthens the closed-loop moat. Build only after atomic action integrity and rollback are complete.
2. **Voice / one-tap night capture.** A tired parent speaks a short update; Somni parses it into a proposed structured log, reads back the times, and requires confirmation before saving. This directly reduces parent effort.
3. **Clinician-ready weekly brief.** Produce an exportable trend/intervention/outcome summary plus questions for a GP or child-health nurse, with careful non-medical wording and source links.
4. **Caregiver shift handoff.** Generate “what happened, what changed, what to do next,” with acknowledgement and conflict-safe ownership between caregivers.

The strongest product bet is option 1. The fastest visible usability win is option 2. The strongest trust/distribution asset is option 3.

## Minimum path to a new launch decision

1. Confirm whether the linked Supabase project is production or staging; reconcile deployed code and migrations with a minimal reviewed change.
2. Fix and test email-confirmation invite return without creating unauthorized users.
3. Implement real incident switches, cohort control, monitoring, and automatic stop paths.
4. Perform and record non-production restore, Vercel rollback/DB forward-fix, and unsafe-AI/data-exposure/provider table-top drills.
5. Complete WebKit/iOS, mobile/offline/PWA, Web Push, cron, webhook, cancellation, provider-failure, and error-boundary evidence.
6. Capture actual model usage/cost and add an idempotent/atomic chat action lifecycle.
7. Make citations clickable and obtain professional legal, privacy, clinical, and security review.
8. Create a clean release branch/commit, rerun every gate from that exact SHA, and repeat Stage 7 decision review.

## Git and release disposition

After a fresh `git fetch origin main`, the repository is on `main` at `8106e21a91f81cb057f105befbbed91d3f16391e`; `origin/main` is `1ea89719eb1e364248f357a304729ba375dc966c`, so local is one commit ahead and not behind. The working tree is **not clean**: 92 modified, 34 deleted, 64 untracked files, and zero staged. The tracked diff is 126 files with 4,191 insertions and 17,084 deletions at the final status snapshot. The tracked code/config patch fingerprint (excluding docs, root README, and Playwright HTML) is SHA-1 `374fe9bea35254b9ead38019513dedc3591cb71e`; the corresponding untracked-code manifest fingerprint is `24e9d9792915cdc93331d8f48b9750c700225baf`.

The unpublished local commit itself contains scratch/generated artefacts. `playwright-report/index.html` is already tracked despite the ignore rule, and the repository tracks test-account passwords in `docs/TEST_ACCOUNTS.md` and `somni_eval/config.json`. No new production-key pattern was found, but deleting those artefacts in a later commit would still publish them in history. Five required security migrations are currently untracked. Pushing only the existing commit would omit the app/schema compatibility work; committing everything would publish a mixed, oversized, insufficiently reviewable release.

The linked database is also ahead of the deployed source. A broad commit/push would be a de facto unreviewed production release and is therefore withheld under the No-Go decision. No Stage 7 file was staged, committed, or pushed.

This is deliberate risk control, not unfinished housekeeping. A minimal compatibility deployment should be planned separately if the linked project is production; otherwise keep the linked project isolated as staging.
