# Billing Reconciliation Runbook

Stripe is the external source of truth for charges and subscription lifecycle events. Somni stores
a local subscription projection used for application access decisions. This runbook reconciles the
two when webhook delivery, ordering, or local persistence fails.

> **Stage 7 status — manual tooling and alerts are not implemented (19 July 2026):** The repository
> has a signed Stripe webhook handler and structured `actionRequired` error logs, but it has no
> `ops_alerts` table or alert delivery integration and no
> `scripts/ops/sync-stripe-subscription.ts` command. Do not run or cite that nonexistent script.
> A full subscription reconciliation job and a rehearsed recovery procedure remain launch evidence
> gaps.

## How to identify a possible mismatch

- A user reports a successful payment while Somni still shows free or inactive access.
- Stripe shows a failed delivery for Somni's webhook endpoint.
- Vercel runtime logs contain `Stripe webhook processing failed` with `actionRequired: true`.
- Stripe and the matching row in Supabase `subscriptions` disagree on subscription identifier,
  status, plan interval, or current-period end.

Structured log fields do not notify an operator by themselves. Someone must actively review the
logs until an alert path is implemented and verified.

## 1. Preserve evidence and limit scope

1. Record the affected environment, time range, user report, Stripe event ID, event type, delivery
   attempts, and HTTP result. Do not copy secret keys or full payment data.
2. Confirm the correct Stripe mode: test and live data are separate.
3. In Supabase, identify the matching subscription row using an approved administrative path.
4. Determine whether the issue affects one customer, one event type, or multiple subscriptions
   before changing anything.

## 2. Replay a failed webhook

Use replay when Stripe has a failed delivery and the application defect or outage has been fixed.

1. In Stripe Dashboard, open **Developers > Webhooks** and select the endpoint for the affected
   environment.
2. Open the failed event and inspect the latest response. If it is a signature error, first verify
   that `STRIPE_WEBHOOK_SECRET` belongs to this exact endpoint and environment.
3. Resend one event.
4. Confirm Stripe receives a 2xx response, the Vercel log has no processing error, and the expected
   `subscriptions` row now matches Stripe.
5. Only then replay the remaining bounded set and verify the final state.

The handler contains protection intended to ignore older subscription events when the local row is
newer, but replay safety still requires observing the final state. A successful HTTP response alone
is not sufficient evidence.

## 3. Manual reconciliation when replay is insufficient

There is currently no supported repository script or admin UI that safely pulls and rewrites one
subscription from Stripe. Do not paste the old example command into a terminal and do not make an
unreviewed direct database edit.

For a single mismatch:

1. Compare Stripe customer, subscription, price interval, lifecycle status, and current-period end
   with the local `subscriptions` row.
2. Look for a corresponding failed or missing webhook event and prefer replay through the normal
   signed handler.
3. If no replayable event can repair the row, record the mismatch and prepare a reviewed,
   user-specific remediation with an exact before/after value and rollback. Two-person review is
   recommended for a live billing change, but the project must assign its actual approvers.
4. Re-test the affected user's access and confirm no other profile was changed.

For multiple mismatches, stop individual edits. A purpose-built dry-run reconciliation tool must be
implemented and reviewed before bulk correction. It should report differences first, require an
explicit apply mode, limit its environment and scope, redact identifiers, and be idempotent.

## 4. Provider outage

- Existing local subscription state may continue to control access, but checkout, portal, customer
  deletion, or fresh webhook processing can fail.
- No in-app outage banner or billing feature flag is currently implemented. Do not claim that one
  can be enabled from Edge Config or an environment variable.
- Pause promotional activity and avoid repeated user retries while Stripe is degraded. If upgrades
  must be disabled, use a reviewed deployment or another control that is verified in the deployed
  environment.
- After recovery, inspect failed events, replay a small bounded sample, reconcile final state, and
  check for duplicated or missing customer/subscription records.

## Common scenarios

- **Cancelled but access remains:** Check whether cancellation is scheduled for period end. Compare
  Stripe's current lifecycle state and period end with the local row before treating it as a bug.
- **Invalid signature:** Verify endpoint URL, environment, raw request handling, and the exact
  endpoint signing secret. Rotate only when compromise or misconfiguration warrants it.
- **Profile cannot be resolved:** Check `client_reference_id`, `metadata.profile_id`, the stored
  Stripe customer ID, and the stored subscription ID. Do not re-link by email without a reviewed
  identity check; email alone is not a safe billing identifier.
- **Out-of-order event:** Inspect event creation time and the final Stripe object. Confirm the local
  row represents the latest state after replay.

## Exit evidence

Close a billing incident only after Stripe and Supabase agree, the user's entitlements are correct,
the affected webhook delivery is successful or explicitly accounted for, adjacent profiles are
unchanged, and the evidence is recorded without sensitive payment or identity data.
