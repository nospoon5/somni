# Somni Docs Guide

This folder contains current product and operational documentation. Completed implementation
plans, legacy reviews, and superseded handoffs are kept in [`archive/`](../archive/).

## Live Working Plan — Start Here

- [Somni_Implementation_Plan_Alpha_1.2.md](Somni_Implementation_Plan_Alpha_1.2.md)
  The sequential Stage 0–7 plan for launch blockers, efficiency, Next Best Action, mobile UX,
  chat optimisation, caregiver hardening, launch operations, and the final launch decision.

- [Somni_Launch_Readiness_Report_Alpha_1.2.md](Somni_Launch_Readiness_Report_Alpha_1.2.md)
  The Stage 7 evidence pack and formal Alpha 1.2 No-Go launch recommendation.

An agent taking a stage should read the root README and this plan in full, then follow the
stage-specific required reading, gates, and handoff instructions.

## Specialist Living Plans

- [Chat_QA_and_Testing_Plan.md](Chat_QA_and_Testing_Plan.md)
  The companion evaluation framework for Alpha 1.2 Stages 2, 4, and 7. It is not a separate
  implementation sequence.


## Core Product Guides

- [somni_vs_chatgpt.md](somni_vs_chatgpt.md)
  The fair current competitive benchmark and Somni's intended closed-loop advantage.

- [somni_context.md](somni_context.md)
  What Somni is, who it is for, product principles, and live features.

- [somni_architecture.md](somni_architecture.md)
  Technical source of truth for routes, schemas, dynamic adapters, and background flows.

- [somni_ai_persona.md](somni_ai_persona.md)
  Tone of voice, style guides, and response constraints for the coach.

- [somni_corpus_plan.md](somni_corpus_plan.md)
  Rules for the curated knowledge base and sleep corpus.

- [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)
  Pre-created archetype accounts for local and end-to-end testing.

## Checklists & Operations

- [somni_verification_checklist.md](somni_verification_checklist.md)
  The checklist to run before and after making codebase changes.

- [somni_release_checklist.md](somni_release_checklist.md)
  Production checklist for staging releases and feature gates.

- [somni_support_triage.md](somni_support_triage.md)
  Triage guidelines for handling database-backed support requests.

- [security_model.md](security_model.md)
  Current security boundaries, threat mitigations, linked hardening migrations, and residual risk.

- [privacy_operations.md](privacy_operations.md)
  Data export, baby deletion, account deletion, retention, and browser-storage handling.

- [backup_restore_runbook.md](backup_restore_runbook.md)
  Backup ownership, restore procedure, verification, and evidence requirements.

- [deployment_runbook.md](deployment_runbook.md)
  Staged deployment, observation, rollback, and stop-condition procedure.

- [incident_response.md](incident_response.md)
  Severity model, containment steps, escalation, and incident communication.

- [billing_reconciliation.md](billing_reconciliation.md)
  Stripe-to-Somni reconciliation and exception handling.

- [analytics_and_launch.md](analytics_and_launch.md)
  Privacy-safe launch analytics, monitoring, and prohibited data collection.

## Document Precedence

If two current docs disagree on system behavior:

1. [somni_architecture.md](somni_architecture.md)
2. [Somni_Implementation_Plan_Alpha_1.2.md](Somni_Implementation_Plan_Alpha_1.2.md) for work
   status, stage scope, and quality gates
3. [somni_context.md](somni_context.md) for product intent
4. The relevant specialist current document

If a codebase change alters system behavior, update the relevant documentation in the same work stream.

## Archived rollout records

- [Schedule Adaptation plan](../archive/Implementation_Plan_Schedule_Adaptation.md)
- [Notifications plan](../archive/Implementation_Plan_Notifications.md)
- [Alpha 1.1 plan](../archive/Implementation_Plan_Alpha_1.1.md)
- [Earlier implementation plans and reviews](../archive/)

Archived records are historical evidence, not current instructions.

