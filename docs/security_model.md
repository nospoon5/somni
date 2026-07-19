# Security Model & Threat Assessment

This document describes the implemented Somni Alpha 1.2 security boundaries as of 19 July 2026.
It separates controls already enforced in code/database from evidence that Stage 7 must still
produce before launch.

## Trust Boundaries

- Supabase Auth establishes identity. `src/proxy.ts` refreshes the session, but it is not an
  authorization boundary.
- Server Actions and Route Handlers re-check the authenticated user. Baby-scoped operations also
  resolve an owned baby or an accepted caregiver share.
- Supabase Row Level Security (RLS), constrained database functions, triggers, grants, and indexes
  remain the final data boundary if a caller bypasses the UI.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It is used only in bounded workflows that genuinely
  need cross-row/admin access: billing and quota synchronization, notification fan-out, support
  rate counting, the authenticated privacy export/deletion workflows, and the cron-authenticated
  memory backfill. These paths must scope queries to the established user/baby and return only
  allowlisted data.

## Browser and Next.js Controls

- `src/proxy.ts` creates a fresh nonce for each rendered document. Production CSP permits
  nonce-bearing scripts and style elements, blocks script attributes, frames, objects, and media,
  and limits images, fonts, connections, workers, forms, and base URLs.
- Production does not allow `script-src 'unsafe-inline'` or `'unsafe-eval'`. Development retains
  the framework-required unsafe evaluation/style behavior only for local tooling.
- React still emits a small number of inline `style` attributes, so CSP temporarily retains the
  narrower `style-src-attr 'unsafe-inline'` exception. This does not relax script execution.
- `upgrade-insecure-requests` is added only on an HTTPS request. This preserves HTTPS enforcement
  on Vercel without breaking assets when a production build is tested over local HTTP.
- `next.config.ts` sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and one-year HSTS with subdomains.
- Per-request nonces require dynamic HTML rendering. That security/performance trade-off must be
  measured in Stage 7; it is not a reason to weaken the policy.
- Next.js Server Actions provide their normal Origin/Host checks. Route Handlers authenticate the
  user and use POST/JSON where applicable. CSP is not treated as a complete CSRF defense; any new
  cookie-authenticated cross-origin or form-compatible endpoint requires an explicit CSRF review.

## Linked Supabase Hardening

`npx supabase migration list --linked` was aligned through `20260719130000` on 19 July 2026.
The final security migrations are:

- `202607181751_secure_invite_tokens.sql`: random caregiver tokens are stored only as SHA-256
  hashes and expire.
- `202607182300_sleep_logs_attribution.sql`: sleep logs identify the caregiver who recorded them.
- `20260719090000_authorization_hardening.sql`: atomic invite acceptance and rotation,
  caregiver-only delegation, hidden pending invitations, revoked direct share updates, and
  immutable `babies.profile_id` ownership.
- `20260719120000_sleep_log_audit_hardening.sql`: the database owns log attribution/audit fields
  and prevents caregiver edits/deletes after the 48-hour correction window.
- `20260719130000_sleep_log_idempotency.sql`: duplicate completed intervals for the same baby are
  rejected.

## Threat Models and Implemented Mitigations

### 1. Caregiver invitation theft or privilege escalation

**Threat:** Someone guesses/reuses an invite, accepts one for a different email, updates a pending
share directly, invents a stronger role, or changes baby ownership.

**Controls:**

- Owners generate 32-byte random tokens; only SHA-256 hashes are stored and links expire after
  seven days.
- Signed-out login/signup returns only to a validated internal invitation URL, preventing an open
  redirect while preserving the private token.
- `accept_baby_invite` atomically verifies authenticated JWT email, raw token, pending state, and
  expiry. It clears the token on success and exposes no pending family details beforehand.
- The only delegated role is `caregiver`. Authenticated callers cannot directly update shares;
  owners use the constrained `rotate_baby_invite` function or revoke the row.
- `babies.profile_id` is immutable through grants and a trigger. Ownership transfer is deliberately
  unsupported until a separately reviewed workflow exists.

### 2. Cross-baby access, forged attribution, or history tampering

**Threat:** A user selects an inaccessible baby, writes against a stale/default baby, claims that
another caregiver logged a sleep, rewrites old history, or retries a completion to duplicate
notifications/adaptation.

**Controls:**

- The HTTP-only active-baby cookie is treated as a preference, not authority. Server helpers and
  RLS validate owner or accepted-caregiver access on every baby-scoped operation.
- Sleep writes require an explicit validated baby. Database triggers force `logged_by` to the
  authenticated actor and preserve the original baby/creation fields.
- The 48-hour database boundary prevents old-log update/delete, while unique partial indexes allow
  one active session and one copy of each completed baby/start/end interval.

### 3. AI prompt injection or unsafe health advice

**Threat:** A prompt tries to reveal system instructions, bypass safety rules, obtain diagnosis or
medication permission, or elicit unsafe sleep-environment advice.

**Controls:**

- Pre-generation checks route urgent medical, emergency, and parent-crisis language to clear
  Australian escalation guidance.
- The system prompt states sleep-coaching and evidence boundaries and rejects persona/rule
  override attempts.
- Post-generation filters detect and replace unsafe medication permission and unsafe sleep-space
  guidance; focused safety/unit and benchmark suites cover these boundaries.
- Normal chat enforces plan quota. Retrieval logging redacts user/profile/baby identifiers and does
  not include query text outside explicitly authorised fixture evaluation.
- A client-controlled `x-eval-mode` header is insufficient. Read-only evaluation requires an
  untracked `SOMNI_EVAL_SECRET` of at least 32 characters and constant-time comparison; authorised
  evaluation skips quota and all message, memory, and plan writes.

### 4. Billing forgery, replay, or deletion inconsistency

**Threat:** A caller forges/replays a Stripe webhook, stale events overwrite newer subscription
state, or an account is deleted while external billing remains active.

**Controls:**

- Stripe verifies the raw webhook body and signature with `STRIPE_WEBHOOK_SECRET` before processing.
- Subscription synchronization compares Stripe event time with local update time and ignores stale
  out-of-order events.
- Account deletion reads billing state first, fails closed on inconsistent/live uncleanable state,
  removes the Stripe customer (which cancels subscriptions), and deletes the Supabase auth user
  last. Missing-already-deleted Stripe resources make retries idempotent.

### 5. Admin/support access abuse

**Threat:** A normal user lists support tickets or calls an admin mutation directly.

**Controls:**

- Admin access is based on the authenticated profile row having `profiles.is_admin = true`; it is
  not based on email domain or a client-visible allowlist.
- `requireAdmin` is called in the admin layout and again inside admin Server Actions. Normal users
  can insert their own support request but cannot list tickets.
- The former support returning-row RLS failure is resolved. The server-only five-per-hour count is
  scoped to the authenticated profile and fails closed if the count cannot be established.

### 6. Privacy export/deletion leakage

**Threat:** An export reveals credentials, tokens, Stripe identifiers, or another caregiver's data;
deletion leaves billable or orphaned account state.

**Controls:**

- Export uses paginated reads and an explicit output allowlist. Auth metadata, service credentials,
  push endpoints/keys, invitation hashes, Stripe customer/subscription IDs, and other caregivers'
  identifiers/contributions are excluded.
- Baby deletion is owner-only and one database parent deletion cascades atomically.
- Account deletion requires the exact server-checked confirmation phrase, removes applicable
  pending email invitations, cleans Stripe first, then deletes the auth user and cascading data.
- Logout and completed deletion clear all Somni-prefixed local/session browser storage.

## Residual Launch Conditions

These are not claims that the resolved controls are absent. They are evidence or operational risks
that still block an unconditional launch decision:

- Complete and grade the 110-question AI core benchmark plus seven multi-turn/adversarial
  extensions; unresolved SEV-1/SEV-2 safety failures require Conditional Go or No-Go.
- Measure authenticated-route and public-page performance with the dynamic nonce policy enabled.
- Rehearse backup/restore and application rollback with timestamped evidence, named owners, and
  verified recovery outcomes.
- Confirm pre-created test credentials cannot access production and rotate them before launch if
  they were reused or exposed beyond the non-production test project.
- Keep the service-role key out of clients and logs, rotate it after any suspected disclosure, and
  follow the [incident-response](incident_response.md) and
  [backup/restore](backup_restore_runbook.md) runbooks for containment and recovery.
