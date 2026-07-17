# Somni - Product Context Summary

## Current Delivery Status (2026-07-17)

- Recently completed work: caregiver sharing, balanced schedule adaptation, and caregiver notifications
- Current branch target: `main`
- Product state: usable first cut across auth, onboarding, dashboard, sleep logging, chat,
  billing, support, adaptive daily plans, caregiver sharing, push notifications, and AI memory
- Launch state: not ready to launch; Alpha 1.2 Stage 0 contains confirmed blockers
- Live execution source: `docs/Somni_Implementation_Plan_Alpha_1.2.md`

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
- Support form backed by the `support_tickets` table and an admin support view
- AI memory stored on the baby record and refreshed by cron
- Accepted caregivers can share one baby record and receive sleep-session alerts
- Meaningful early or late wakes can produce a damped same-day schedule suggestion for parent approval
- Web Push alerts respect each caregiver's quiet hours while the in-app feed remains available

## Current Product Strengths

- Somni has structured baby, sleep, plan, caregiver, and notification state that a generic
  conversation does not automatically maintain as an operational workflow
- Tone is warm and on-brand
- The AI is much better than before at concise, practical answers
- Retrieval coverage improved meaningfully in Stages 12 to 14
- The sleep score now stays honest for sparse data instead of grading a parent too early

## Current Product Risks

- Support submission currently fails for normal users because the successful insert requests a
  row that RLS does not allow them to select.
- Signed-out caregiver invitation handoff and role enforcement are not launch-safe.
- Settings and sign-out are hard to discover from the main mobile navigation.
- Lint and the production dependency audit are not green.
- Concurrent sleep completion can trigger duplicate downstream work.
- Mobile loading, failure, accessibility, and bottom-navigation behaviour need hardening.
- Chat can spend roughly 4,000 prompt tokens and two model generations on an ordinary message.
- Retrieval is better, but edge cases and the complete AI safety baseline still require
  regression testing after every material change.
- Current Next Best Action advice is not yet consistently concrete enough to demonstrate a
  meaningful advantage over a well-configured current ChatGPT experience.

## Current Strategic Focus

Execute `docs/Somni_Implementation_Plan_Alpha_1.2.md` sequentially. The strategic product goal
is a closed loop: observe real sleep, recommend one concrete next action, help the family act,
keep caregivers aligned, and measure what happened. No production launch should proceed until
Stage 7 issues a formal Go or approved Conditional Go decision.
