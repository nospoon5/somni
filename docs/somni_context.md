# Somni - Product Context Summary

## Current Delivery Status (2026-07-19)

- Stage 7 is complete with a formal No-Go; Stage 6 is reopened as Blocked because launch
  operations and rehearsals are not yet operable
- Current branch target: `main`
- Product state: launch-candidate engineering across auth, onboarding, active-baby selection,
  dashboard, sleep logging, chat, billing, support, adaptive plans, caregiver sharing,
  notifications, privacy controls, and AI memory
- Launch state: external deployment/cohort remains blocked by the conditions in
  `docs/Somni_Launch_Readiness_Report_Alpha_1.2.md`
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
- Baby onboarding plus active-baby switching for owned and shared babies
- Sleep style questionnaire
- Sleep logging with single active sleep-session protection
- Dashboard sleep score and summaries
- Daily plan storage and chat-driven plan updates
- AI chat with RAG over the curated corpus
- Free-tier message limits
- Stripe checkout and billing portal
- Support form backed by the `support_tickets` table and an admin support view
- Profile data export, owner-only baby deletion, and confirmed account deletion with Stripe cleanup
- AI memory stored on the baby record and refreshed by cron
- Accepted caregivers can share one baby record and receive sleep-session alerts
- Meaningful early or late wakes can produce a damped same-day schedule suggestion for parent approval
- Web Push alerts respect each caregiver's quiet hours while the in-app feed remains available
- Next Best Action guidance and a caregiver handoff timeline on the dashboard

## Current Product Strengths

- Somni has structured baby, sleep, plan, caregiver, and notification state that a generic
  conversation does not automatically maintain as an operational workflow
- Tone is warm and on-brand
- The AI is much better than before at concise, practical answers
- Retrieval coverage, source attribution, and edge-case ranking improved meaningfully
- The sleep score now stays honest for sparse data instead of grading a parent too early
- Caregiver invitations now use expiring hashed tokens and atomic, email-bound acceptance
- Structured data export and account deletion give parents direct privacy controls

## Resolved Alpha 1.2 Engineering Gaps

- Normal-user support submission no longer depends on forbidden RLS read-back, while support
  ticket listing remains admin-only.
- Signed-out invite return, token/expiry/email validation, caregiver-only roles, and permanent
  baby ownership are enforced in both application code and the linked database.
- Sleep logs preserve caregiver attribution, protect history older than 48 hours, and reject
  duplicate completed intervals at the database layer.
- Navigation exposes profile, billing, support, active-baby switching, and sign-out on mobile.
- CSP, privacy export/deletion, browser-storage cleanup, logging redaction, fixture safety, and
  accessibility coverage were added during Stages 0-7.
- Static checks, unit tests, the production dependency audit, and the guarded browser matrix are
  now the maintained gates; removed temporary-user scripts are not part of the release process.

## Remaining Stage 7 Launch Blockers

- The full AI safety and quality benchmark, including adversarial and multi-turn extensions,
  must be completed and graded against the approved thresholds.
- Performance evidence must quantify the deliberate dynamic-rendering cost of per-request CSP
  nonces and the linked-database latency of authenticated routes.
- Backup/restore and deployment rollback procedures must be rehearsed with timestamped evidence,
  named owners, and verified recovery outcomes.
- Pre-created test credentials must be confirmed as non-production-only and rotated before launch
  if there is any production access or credential-reuse risk.
- Stage 7 must publish the formal Go, Conditional Go, or No-Go recommendation. Resolved code gaps
  are not, by themselves, launch approval.

## Current Strategic Focus

Execute `docs/Somni_Implementation_Plan_Alpha_1.2.md` sequentially. The strategic product goal
is a closed loop: observe real sleep, recommend one concrete next action, help the family act,
keep caregivers aligned, and measure what happened. No production launch should proceed until
Stage 7 issues a formal Go or approved Conditional Go decision.
