# Somni - Alignment Notes

## Why This File Exists

Git already preserves file history and diffs, so a separate "version history" file is not required for technical traceability.

However, git history alone is not beginner-friendly. This file exists to record the human reasoning behind major alignment decisions in plain language.

## Current Alignment Decision

Date: 2026-04-02

Decision:

- `docs/somni_architecture.md` is now the active V1 source-of-truth document.

Why:

- The previous repo state had drift between product planning, schema design, and actual code.
- Continuing implementation without a stable architecture contract would create rework and confusion.

## What Changed In The Architecture Cleanup Pass

1. Reframed the architecture doc as the V1 source of truth rather than a loose overview.
2. Updated wording for Next.js 16 so it talks about App Router Route Handlers and Server Actions.
3. Clarified that auth redirects and session refresh are not the main security boundary.
4. Fixed the daily usage reset rule so it uses the user's timezone consistently.
5. Made the onboarding schema explicit by defining five score columns.
6. Expanded the `messages` schema so stored assistant responses can include safety metadata.
7. Clarified the intended `corpus_chunks` shape for the future upload script.
8. Tightened the PWA section so offline behavior is honest about what is and is not guaranteed in V1.

## What Still Needs To Be Aligned

These should be updated to match the architecture doc next:

- `docs/somni_implementation_plan.md`
- `supabase/migrations/20260402_init_schema.sql`
- `docs/somni_architect_handoff.md`
- any auth, onboarding, and uploader code we create from this point onward

## Working Rule Going Forward

Before building a major feature:

1. Check the architecture doc first.
2. If implementation discovers a better design, update the architecture doc deliberately.
3. Then update the implementation plan and schema files to match.

This keeps the repo understandable for both humans and AI-assisted development.
