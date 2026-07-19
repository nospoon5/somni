# Analytics and Controlled Launch Strategy

This document defines the minimum evidence Somni needs for a privacy-conscious Alpha 1.2 rollout.
It does not claim that planned analytics or rollout controls are already implemented.

> **Stage 7 status — measurement and rollout controls are not implemented (19 July 2026):** No
> PostHog SDK, product-event pipeline, Vercel Web Analytics integration, cohort flag, or general
> feature-flag service was found in the repository. There is also no tested kill switch for Next
> Best Action or AI chat. The events below are a measurement specification, not current telemetry.

## 1. Current observability baseline

Somni currently emits structured server logs. The logging helper redacts keys such as user, profile,
baby, email, token, cookie, Stripe customer, and Stripe subscription identifiers. These logs can
support reliability investigation, but they are not a complete product-analytics system and do not
prove activation or retention.

Before launch, verify in the deployed environment:

- where logs are retained and for how long;
- who can access them;
- that redaction works on representative production-format entries;
- that required error signals can be found without collecting chat or sleep content; and
- how an on-call person learns about urgent errors, because no alert delivery is configured in the
  repository.

## 2. Proposed minimum event specification

If analytics is implemented, use a small allow-list of coarse events. Suggested names are:

- `onboarding_completed`
- `first_sleep_log_created`
- `chat_request_completed`
- `daily_plan_viewed`
- `next_best_action_viewed`
- `next_best_action_completed`
- `support_request_submitted`
- `checkout_started`
- `subscription_activated`

For each event, document its purpose, trigger, allowed properties, retention, access, and deletion
behaviour before collection begins. Prefer aggregate counts and short categorical fields. Do not
send names, email addresses, stable raw profile or baby UUIDs, chat text, sleep notes, invitation
tokens, push endpoints, user-agent strings, or Stripe identifiers to a product-analytics provider.
Hashing a stable user identifier is pseudonymisation, not anonymisation, so do not describe it as
anonymous without a reviewed privacy design.

Session-replay tools are out of scope for Alpha 1.2 because Somni handles sensitive caregiver chat
and baby sleep data.

## 3. Consent and data rights

Do not enable a third-party analytics SDK until its consent basis, privacy notice, retention,
regional processing, user export, and deletion path have been reviewed. The current account export
and deletion implementation does not automatically prove that a future analytics provider is
covered.

If reliable consent-aware analytics cannot be completed before the controlled alpha, launch with no
third-party product analytics and use privacy-minimised manual cohort feedback plus redacted
reliability logs.

## 4. Controlled-launch phases

The phase sizes below are limits, not automatically authorised targets. Access control for each
cohort must be demonstrated. Distributing a link is not a feature flag.

### Phase 1: internal validation

- **Size:** Only explicitly approved internal testers and selected trusted testers.
- **Purpose:** Validate login, onboarding, chat safety, sleep logging, caregiver access, support,
  account data export, and billing behaviour in the deployed environment.
- **Entry evidence:** Stage 7 decision permits the cohort; named response contacts and a tested
  rollback path are available.
- **Stop:** Any SEV-1/SEV-2, uncontained unsafe AI output, cross-account access, unexplained data
  mutation, or inability to receive support reports.

### Phase 2: small alpha

- **Size:** No more than 50 explicitly invited users.
- **Purpose:** Measure task usefulness, reliability, support load, and safety feedback.
- **Entry evidence:** Phase 1 exit review; no unresolved SEV-1/SEV-2; a documented way to restrict
  access to the approved cohort; trustworthy measurement for each stop condition.
- **Stop:** Any SEV-1/SEV-2, support reports from more than 10% of active users in the review window,
  or a sustained latency threshold that has been defined and can actually be measured.

### Phase 3: expanded alpha

- **Size:** No more than 500 explicitly approved users.
- **Purpose:** Validate concurrency, quotas, billing reconciliation, support capacity, and cost.
- **Entry evidence:** Phase 2 review, load evidence, verified backup/restore evidence, tested billing
  recovery, and an operational monitoring/alert path.
- **Stop:** Failed or divergent Stripe processing, sustained quota exhaustion, breached cost limit,
  SEV-1/SEV-2, or loss of support/monitoring coverage.

### Phase 4: public alpha

- **Entry evidence:** Prior phases completed with documented results, zero unresolved SEV-1/SEV-2
  risks, completed privacy/security/safety review, and a recorded Stage 7 Go decision.

## 5. Feature exposure reality

There is no repository-backed feature flag for Next Best Action, AI chat, or cohort membership.
Before using a feature flag in a launch plan, implement it, define its default, restrict who may
change it, log changes, test both states in the deployed application, and rehearse rollback. Until
then, a high-risk feature must either ship to the whole deployed audience or be omitted through a
reviewed deployment.

## 6. Evidence required at each phase boundary

Record the cohort, dates, denominator for every percentage, data source, reliability and safety
results, support volume, costs, incidents, open risks, and the explicit advance/hold decision. A
phase cannot pass using events that are merely planned or platform dashboards that no one verified.
