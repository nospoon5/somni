# Somni Docs Guide

This folder keeps the current product documentation and completed rollout records. Superseded implementation plans, legacy reviews, and deprecated test sheets are kept in [`archive/`](../archive/).

## Recently Completed Plans

- [Implementation_Plan_Schedule_Adaptation.md](Implementation_Plan_Schedule_Adaptation.md)
  Completed rollout record for damped schedule rescue, chat sleep logging, and the dashboard approval banner.

- [Implementation_Plan_Notifications.md](Implementation_Plan_Notifications.md)
  Completed rollout record for Web Push, quiet hours, caregiver alerts, and the in-app bell feed.

## Living Plans (Start here)

- [Chat_QA_and_Testing_Plan.md](Chat_QA_and_Testing_Plan.md)
  The testing and evaluation framework to verify and polish the conversational coaching quality.


## Core Product Guides

- [somni_vs_chatgpt.md](somni_vs_chatgpt.md)
  A comprehensive guide explaining how Somni's specialized sleep AI differs from and outperforms generic models like ChatGPT.

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
  Triage guidelines for handling logged support forms.

## Document Precedence

If two current docs disagree on system behavior:

1. [somni_architecture.md](somni_architecture.md)
2. [somni_context.md](somni_context.md)
3. The relevant completed implementation plan or current living plan

If a codebase change alters system behavior, update the relevant documentation in the same work stream.

