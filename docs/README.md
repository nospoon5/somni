# Somni Docs Guide

This folder contains current product and operational documentation. Completed implementation
plans, legacy reviews, and superseded handoffs are kept in [`archive/`](../archive/).

## Live Working Plan — Start Here

- [Somni_Implementation_Plan_Alpha_1.2.md](Somni_Implementation_Plan_Alpha_1.2.md)
  The sequential Stage 0–7 plan for launch blockers, efficiency, Next Best Action, mobile UX,
  chat optimisation, caregiver hardening, launch operations, and the final launch decision.

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

