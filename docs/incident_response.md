# Incident Response Plan

This document defines a practical response process for critical system failures, data exposure,
unsafe AI output, billing failures, and provider outages.

> **Stage 7 operational gap (19 July 2026):** The repository contains structured JSON logging with
> redaction, but it does not contain a paging integration, Slack alert integration, in-app outage
> banner, maintenance mode, or AI kill switch. `AI_CHAT_ENABLED`,
> `NEXT_PUBLIC_MAINTENANCE_MODE`, and the Edge Config key `provider_outage_message` are not
> implemented controls. Do not set them and assume traffic or AI generation has stopped.

## Severity levels

- **SEV-1 (critical):** Confirmed or credible cross-account data exposure, material security breach,
  catastrophic data loss, unsafe AI output with immediate risk of serious harm, or complete outage.
- **SEV-2 (high):** A core flow is unavailable or materially degraded, including sustained AI chat
  failure, billing state divergence, or failed Stripe webhook processing.
- **SEV-3 (medium):** A non-critical feature or localised defect with a safe workaround.

When impact is uncertain, begin at the higher plausible severity and downgrade only when evidence
supports it.

## Roles and communications

At incident declaration, explicitly record who is acting as:

- **Incident coordinator:** owns severity, decisions, timeline, and stakeholder updates.
- **Technical responder:** investigates, contains, and validates recovery.
- **Communications contact:** handles affected-user and provider communication when required.

These are responsibilities, not evidence that named people are assigned. Before launch, Somni needs
a named, reachable primary and backup contact plus an approved escalation channel. No Slack,
email, or paging destination is configured by this repository.

For every incident, keep a timestamped log of symptoms, decisions, changes, and validation. Do not
copy raw chat messages, baby data, credentials, invitation tokens, or Stripe identifiers into a
general incident channel.

## First response for every SEV-1 or SEV-2

1. Record when the incident was detected, the reporter, affected environment, and known impact.
2. Preserve relevant redacted Vercel runtime logs, Supabase logs, provider event IDs, and deployment
   identifiers.
3. Stop unrelated deployments and data migrations.
4. Choose the narrowest verified containment action. If the required switch does not exist, state
   that clearly and use an explicit code deployment, rollback, provider credential action, or
   platform traffic restriction whose effect can be tested.
5. Validate containment from a separate session. Changing an environment variable is not evidence
   unless application code consumes it and the deployed behaviour has been observed.
6. Communicate only confirmed facts, impact, workaround, and the next update time.

## Provider outage: LLM, Stripe, Supabase, or Vercel

1. Confirm symptoms in application logs and the provider's official status page.
2. Identify the affected flow and test unaffected read-only paths.
3. For an LLM outage, existing saved plans may remain readable, but this must be verified during the
   incident. Do not promise that all chat behaviour degrades gracefully.
4. For Stripe, follow [Billing Reconciliation](billing_reconciliation.md) and pause promotion of
   upgrades until checkout and webhooks are verified again.
5. There is no implemented Edge Config banner. Communicate through an already approved channel, or
   deploy reviewed status copy if user-facing communication is necessary.
6. After provider recovery, run the relevant smoke flow and check for queued, failed, or duplicated
   work before closing the incident.

## Unsafe AI advice

Treat credible output that could cause serious harm as SEV-1.

1. Preserve only the minimum evidence needed, with personal information removed.
2. Do not rely on `AI_CHAT_ENABLED`; the application does not read it.
3. Until a tested kill switch exists, containment requires a verified emergency deployment that
   blocks AI generation or another tested platform/provider control. Revoking a provider key alone
   may turn unsafe responses into application errors, so verify the user-visible result.
4. Identify whether the failure came from prompt instructions, retrieval, emergency-risk detection,
   model behaviour, or unsafe source material.
5. Add a regression case to the AI evaluation set and automated tests where appropriate.
6. Require a safety review and passing targeted evaluation before restoring AI generation.

The absence of a tested fast kill switch is an explicit launch risk.

## Data exposure or broken authorisation

1. Treat a credible report of another family's data being visible as SEV-1.
2. Preserve request IDs, affected routes, row identifiers, and redacted logs. Do not broaden access
   while investigating.
3. There is no implemented maintenance-mode variable. Contain traffic or the affected route using a
   verified rollback, emergency deployment, or platform control and test that containment.
4. Audit the relevant Supabase row-level security policy, database grants, server-side admin-client
   use, and application authorisation path.
5. Rotate credentials only when exposure or misuse is plausible. Rotation is disruptive and does
   not repair an authorisation flaw by itself.
6. Determine scope, affected people, and data categories. Obtain professional privacy/legal advice
   for notification obligations; this runbook does not make that determination.
7. Add direct-attack regression coverage before restoring the affected flow.

## Runaway cost or request loop

1. Use Vercel runtime logs and the relevant provider dashboard to identify the endpoint, model, and
   request pattern. Product analytics is not currently implemented and is not a reliable source.
2. Apply the narrowest available containment: emergency code change, rollback, provider quota, or a
   Vercel security control verified in the actual project.
3. Confirm request volume and spend have stopped increasing.
4. Fix the loop, retry policy, or abuse path and add a bounded regression/load test before restoring
   the flow.

## Recovery and post-incident work

- Validate the original failure, containment, and recovery from the user-visible path.
- Follow [Backup and Restore](backup_restore_runbook.md) for data recovery and
  [Deployment and Rollback](deployment_runbook.md) for release recovery.
- Reconcile affected support and billing records where relevant.
- Produce a blame-free SEV-1/SEV-2 review within 48 hours, including timeline, impact, root cause,
  evidence, corrective actions, and any control that the incident proved was missing.

An incident is not closed because a provider status page turns green; Somni's affected flow and data
state must also be verified.
