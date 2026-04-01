# Somni – Implementation Plan

## Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14+ (App Router) |
| Hosting | Vercel |
| Backend + DB | Supabase (Postgres) |
| Vector DB | pgvector (Supabase extension) |
| AI | Gemini (Google AI SDK) |
| Embeddings | Gemini `text-embedding-004` |
| Payments | Stripe (Checkout + Customer Portal) |
| PWA | Service Worker + Web App Manifest |
| Styling | Vanilla CSS (design system with custom properties) |

---

## V1 Goal (~6–8 weeks)

User can:
- Sign up and complete onboarding (baby profile + sleep style quiz)
- Log sleep events (start/stop, day/night, tags)
- Chat with AI and receive personalised, source-backed advice
- See a sleep score with trends and actionable insights
- Hit message limit (10/day free) and upgrade to paid
- Manage subscription (monthly $19.99 / annual $99)

---

## Core Features

| Feature | Priority | Stage |
|---------|----------|-------|
| Auth (email/password) | Must have | 2 |
| Baby profile | Must have | 2 |
| Sleep style onboarding | Must have | 3 |
| Sleep logging (start/end + tags) | Must have | 3 |
| Chat UI (streaming) | Must have | 4 |
| RAG pipeline | Must have | 4 |
| AI responses (Gemini) | Must have | 4 |
| Safety rails (emergency, disclaimers) | Must have | 4 |
| Sleep scoring algorithm | Must have | 3 |
| Sleep score display | Must have | 3 |
| Usage limits (10/day free) | Must have | 5 |
| Stripe payments | Must have | 5 |
| PWA install prompt | Should have | 6 |
| Offline sleep logging | Should have | 6 |

---

## Onboarding Inputs

- Baby name
- Baby DOB (→ auto-calculates age band)
- Biggest issue (dropdown: night waking, short naps, bedtime battles, early morning waking, other)
- Feeding type (dropdown: breast, bottle, mixed)
- Bedtime range (dropdown: 6-7pm, 7-8pm, 8-9pm, varies)
- Sleep style questionnaire (5 questions, 1-10 scale each → score → label)

---

## Sleep Logging

- Start sleep (tap button → records timestamp)
- End sleep (tap button → records timestamp)
- Day vs night auto-detected by time (manual override available)
- Optional tags:
  - Easy settle / Hard settle
  - Short nap (<30 min auto-tagged)
  - False start (woke within 30 min of bedtime)
  - Self-settled
  - Needed help

---

## Sleep Score (V1 Formula)

Total = 100 points

### Night Sleep (40 points)
- Disruptive wakes (vs age band expectation)
- Longest stretch (vs age band expectation)
- False starts (any = penalty)
- Bedtime consistency (vs last 7 days average)

### Day Sleep (25 points)
- Nap count (vs age band)
- Average nap duration
- Nap timing consistency

### Total Sleep (20 points)
- Total hours vs age band range

### Settling (15 points)
- Ease of settling (from tags)
- Self-settle ratio

---

## Age Bands

| Age Band | Total Sleep | Naps | Night Wakes (typical) |
|----------|------------|------|----------------------|
| 0–3 months | 14–18h | 4–6 | Frequent (normal) |
| 4–6 months | 13–16h | 3–4 | 1–3 |
| 7–9 months | 12–15h | 2–3 | 0–2 |
| 10–12 months | 11–14h | 2 | 0–1 |

---

## Scoring Rules

- Optimal range = full points
- Slightly outside = mild penalty (20%)
- Far outside = stronger penalty (50–80%)
- No negative scores (floor at 0 per component)

## Status Mapping

- 75–100 → **Improving** ✦
- 55–74 → **Steady** ●
- 0–54 → **Needs Attention** ▼

## Trend Weighting

- Last 24h: 50%
- Last 3 days: 30%
- Last 7 days: 20%

---

## Database Schema

See [somni_architecture.md](file:///C:/AI%20Projects/01_Apps/Somni/docs/somni_architecture.md) for full column-level schema.

Tables:
- `profiles` — user account data
- `babies` — baby details (name, DOB, feeding type, etc.)
- `onboarding_preferences` — sleep style quiz results
- `sleep_logs` — individual sleep events with timestamps and tags
- `messages` — chat history (user + assistant messages)
- `subscriptions` — Stripe subscription status
- `usage_counters` — daily message counts for rate limiting
- `corpus_chunks` — embedded knowledge base chunks with vectors

---

## Build Order (with dependencies)

```
Stage 0: Foundation (docs, agents, folder structure) ✅ DONE
    ↓
Stage 1: Corpus (50+ chunks, embeddings) 🚧 IN PROGRESS
    ├── Extract raw sources ✅
    ├── Initial foundational chunks ✅
    ├── Generate remaining chunks
    └── Embed into pgvector
    ↓
Stage 2: Project Setup + Auth
    ├── Init Next.js + GitHub
    ├── Supabase project + schema
    ├── Vercel deployment
    └── Auth (signup/login/logout)
    ↓
Stage 3: Core Features
    ├── Onboarding flow (depends on: auth, babies table)
    ├── Sleep logging (depends on: auth, sleep_logs table)
    └── Sleep scoring (depends on: sleep_logs data)
    ↓
Stage 4: AI + Chat
    ├── Embed corpus into pgvector (depends on: Stage 1 chunks)
    ├── RAG retrieval (depends on: embedded chunks)
    ├── Chat UI (depends on: auth)
    └── Gemini integration (depends on: RAG + prompt pack)
    ↓
Stage 5: Monetisation
    ├── Usage tracking (depends on: chat API)
    ├── Stripe integration (depends on: auth + profiles)
    └── Upgrade flow (depends on: usage limits)
    ↓
Stage 6: Polish + Launch
    ├── UX review (depends on: all features working)
    ├── Legal pages
    ├── Performance audit
    └── Beta testing
```

---

## Monetisation

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 10 messages/day, sleep logging, delayed sleep score (24h) |
| **Somni Plus (Monthly)** | $19.99/month (first month $9.99) | Unlimited messages, real-time score, personalised plans, trend charts |
| **Somni Plus (Annual)** | $99/year (~$8.25/month) | Same — 58% savings vs monthly |

---

## Key Principles

- Logging must be frictionless (< 3 taps at 3am)
- Advice must feel personalised (not generic AI)
- Keep prompts small and focused
- Calculate metrics in backend, not AI (scores, trends, age bands)
- Safety first — medical disclaimers, emergency redirects, safe sleeping compliance
- Australian English throughout
- Mobile-first design (one-handed, sleep-deprived use)
