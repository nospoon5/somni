# Somni - Product Context Summary

## Current Delivery Status (2026-04-12)

- Active next-step plan: `docs/somni_implementation_plan_v5.md`
- Recently completed work: Stages 11 to 14 from `docs/somni_implementation_plan_v4.md`
- Current branch target: `main` is the working branch
- Product state: usable first cut across auth, onboarding, dashboard, sleep logging, chat,
  billing, support, daily plans, and AI memory

## What Somni Is

Somni is a sleep-first coaching app for parents of babies and young children.

Core promise:

**Calm, source-backed sleep guidance tailored to your baby and your real life.**

## Who It Is For

### Persona 1: Anxious New Mum

- First-time parent
- Wants reassurance and a clear next step
- Tends to worry about whether something is "normal"

### Persona 2: Pragmatic Dad

- Wants direct advice fast
- Likes clear structure and concrete actions
- Values confidence over long explanations

### Persona 3: Return-to-Work Parent

- Juggling daycare, commuting, or rigid time windows
- Needs plans that work in real life, not just ideal conditions
- Wants practical tradeoffs rather than perfection

## Product Principles

- Sleep-first, not a general baby tracker
- Advice should feel personal, not generic
- The app should reduce parent stress, not add guilt
- Somni should be clear about what it knows, what it does not know, and when a health
  professional is the better next step
- Real-world constraints matter: daycare, work schedules, travel, illness, and caregiver
  handoffs are part of the product problem

## Australia-First V1

- Australian English
- Metric units
- Australian-safe sleep alignment
- Emergency direction points to `000`
- Trusted source mix includes Red Nose Australia, Tresillian, Karitane, Raising Children
  Network, RCH Melbourne, and related Australian health sources

## What Is Live Today

- Email/password sign-up and sign-in
- One-baby onboarding flow
- Sleep style questionnaire
- Sleep logging with single active sleep-session protection
- Dashboard sleep score and summaries
- Daily plan storage and chat-driven plan updates
- AI chat with RAG over the curated corpus
- Free-tier message limits
- Stripe checkout and billing portal
- Support form that logs requests to runtime logs
- AI memory stored on the baby record and refreshed by cron

## Current Product Strengths

- Personalisation is stronger than the generic chatbot baseline
- Tone is warm and on-brand
- The AI is much better than before at concise, practical answers
- Retrieval coverage improved meaningfully in Stages 12 to 14

## Current Product Risks

- Sleep score trust is weaker than it should be for very new users with sparse data
- Lint is not green because of two old helper scripts
- Support requests do not reliably capture the page where a problem happened
- Some older docs drifted away from the actual codebase before this cleanup pass
- Retrieval is better, but still has a few weak spots in edge-case scenarios

## Next Strategic Focus

The next execution order is:

1. Foundation cleanup
2. Sleep score v2
3. AI quality hardening
4. Real-world constraint coaching
5. Beta readiness

Those sections are detailed in `docs/somni_implementation_plan_v5.md`.
