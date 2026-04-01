# Agent Rules — Somni (Baby Sleep Coaching App)

## Communication Style

- Assume I have little to no coding experience. Explain each step in plain English as if teaching a beginner.
- Avoid jargon. If you must use a technical term, briefly explain what it means.
- Be concise and friendly. Don't over-explain, but don't skip important context.

## Before Starting Any Task

- Ask clarifying questions about any ambiguities or missing requirements before writing code.
- Summarise your understanding of the task back to me in plain language and confirm before proceeding.
- If the task is large, show me a step-by-step plan first and wait for my approval.

## Coding Philosophy

- Always prefer the simplest, most lightweight solution that achieves the goal.
- Avoid over-engineering. Don't introduce new libraries, frameworks, or dependencies unless truly necessary.
- When there are multiple ways to solve a problem, suggest the simplest one first and briefly explain the trade-offs.
- Make small, focused changes. Avoid rewriting large chunks of code in one go.

## Safety & Transparency

- Tell me which files you are about to create or modify before you do it.
- Warn me clearly if a change could break existing functionality.
- If you're unsure about something, say so rather than guessing.

## Project Context

- Somni is a baby sleep coaching PWA (Progressive Web App) for first-time parents.
- Stack: Next.js, Supabase (Postgres + pgvector), Gemini AI, Stripe, Vercel.
- The app uses RAG (Retrieval Augmented Generation) over a curated sleep knowledge corpus.
- Core features: onboarding, sleep logging, AI chat coaching, sleep scoring, subscriptions.
- Target market: Australia-first (V1). Sources: Red Nose, Tresillian, Karitane, RCH Melbourne.
- Three sleep methodology buckets: Gentle, Balanced, Fast-track.
- Pricing: Free (10 msgs/day), Somni Plus Monthly ($19.99, first month $9.99), Annual ($99/year).

## Safety Rules (Critical — Baby Health Adjacent Product)

- The AI must NEVER give medical advice. Always redirect to GP or 000 for medical concerns.
- All AI responses must include appropriate disclaimers when discussing baby health.
- Emergency queries ("baby isn't breathing", "baby is choking") must immediately redirect to emergency services.
- Follow Red Nose Australia safe sleeping guidelines at all times.
- The system prompt must include hallucination guardrails — only reference information from the provided corpus context.

## Key Documentation

- Context & vision: `/docs/somni_context.md`
- Architecture: `/docs/somni_architecture.md`
- Implementation plan: `/docs/somni_implementation_plan.md`
- Corpus plan: `/docs/somni_corpus_plan.md`
- Prompt engineering: `/docs/somni_prompt_pack.md`
- Architect review: `/docs/somni_architect_review.md`
