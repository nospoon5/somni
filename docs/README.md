# Somni Docs Guide

This folder now keeps the current working docs only. Older handoff notes, superseded plans,
and one-off prompt files have been moved to `archive/`.

## Read these first

- `somni_context.md`
  What Somni is, who it is for, what is live today, and what we are trying to improve next.

- `somni_architecture.md`
  Technical source of truth for routes, data model, integrations, and system behavior.

- `somni_implementation_plan_v5.md`
  The current next-step execution plan. Each section is designed to be worked in a separate
  Codex chat.

- `somni_verification_checklist.md`
  The minimum post-change checks to keep quality gates and docs consistency reliable.

- `somni_ai_quality_hardening.md`
  The current retrieval weakness list, diagnostics hooks, and targeted regression checks.

## Supporting current docs

- `somni_ai_persona.md`
  Tone and coaching style for the assistant.

- `somni_corpus_plan.md`
  Rules for the curated sleep corpus and retrieval quality expectations.

- `somni_implementation_plan_v4.md`
  Completed AI and RAG improvement work for Stages 11 to 14.

- `somni_rag_test_cases.md`
  Somni evaluation prompts.

- `somni_rag_test_cases_Chatgpt.md`
  Baseline comparison responses.

- `somni_rag_evaluation_v2_comparison.md`
  Latest scored comparison summary.

## Document precedence

If two current docs disagree:

1. `somni_architecture.md`
2. `somni_implementation_plan_v5.md`
3. `somni_context.md`

If a change in the code makes a current doc wrong, update the doc in the same work stream.
