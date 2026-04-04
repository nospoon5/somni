# Somni - Product Context Summary

## Vision

Somni is a sleep-first baby coaching PWA for first-time parents.

Core promise:
**Calm, source-backed sleep guidance tailored to your baby.**

## Target Users

### Persona 1: Anxious New Mum
- First-time mother, baby around 3 months old
- Leaning towards a gentle sleep approach
- Feels overwhelmed by conflicting advice
- Needs reassurance and a clear next step

### Persona 2: Pragmatic Dad
- First-time father, baby around 6 months old
- Wants structure and quick results
- Prefers balanced or faster progress
- Needs direct advice for tonight

### Persona 3: Sleep-Deprived Return-to-Work Parent
- Baby around 9-12 months old
- Needs sleep to improve soon
- Has already tried free advice without much clarity
- Wants practical help before the week ahead

## Australia-First (V1) Implications

- Timezone handling uses AEST/AEDT-aware logic
- Date formats should stay in Australian style where displayed to users
- Units should stay metric
- Safe sleep guidance should follow recognised Australian sources
- Trusted sources include Red Nose Australia, Tresillian, Karitane, RCH Melbourne, and Raising Children Network
- Health wording should use Australian English throughout
- Emergency guidance should point to 000 in Australia
- Privacy should be treated as an Australian Privacy Principles issue

## Core Differentiation

- Sleep-only focus rather than a broad baby tracker
- Personalised advice based on logs, baby age, and sleep style
- Coaching that explains the next step instead of just showing data
- Australian-aligned sources and language
- Calm but specific tone

## Core Product Loop

1. Parent logs sleep
2. Parent asks a question
3. Somni interprets baby age, sleep style, and recent sleep patterns
4. Somni responds with a personalised plan
5. The system adapts as more data is logged

## Sleep Methodology Strategy

Somni groups approaches into 3 buckets:

### Gentle
- Responsive, low crying, high involvement
- Methods: pick-up/put-down, patting, shushing, gradual retreat

### Balanced
- Structured with check-ins
- Methods: Ferber-style timed intervals, controlled comforting

### Fast-track
- More direct, faster behaviour change, lower ongoing involvement
- Methods: extinction-based approaches with clear boundaries

User-facing labels: **Gentle** | **Balanced** | **Fast-track**

## Sleep Style Questionnaire

5 questions on a 1-10 scale each.

Stores:
- `sleep_style_score` (average, 1-10)
- `sleep_style_label` (derived from score)

Mapping:
- 1-3 = Gentle
- 4-7 = Balanced
- 8-10 = Fast-track

## Sleep Scoring Strategy

### User Display

Status labels:
- **Improving** (75-100)
- **Steady** (55-74)
- **Needs Attention** (0-54)

Tap to reveal:
- Score (0-100)
- Strongest area
- Biggest challenge
- Tonight's focus

### Scoring Principles
- Measures baby sleep quality, not parenting quality
- Age-aware so expectations change with age band
- Trend-aware across the last 24 hours, 3 days, and 7 days
- Explainable so users can see why the score changed

### Score Components
1. Night sleep quality (40 points)
2. Day sleep quality (25 points)
3. Total sleep quantity (20 points)
4. Settling ease (15 points)

### Rules
- Only count disruptive wakes
- Overnight feeds are neutral for younger babies and slightly negative for older babies
- Contact naps are neutral in V1

## Monetisation

| Tier | Includes |
|------|----------|
| **Free** | Sleep logging and a daily coaching chat cap |
| **Somni Premium** | Removes the daily chat cap and uses Stripe checkout/portal for billing |

Pricing is shown in the live checkout flow. Keep any future price changes out of the docs unless they are verified in the product.

## AI Strategy

- Use Gemini as the primary model
- Use RAG over the curated corpus
- Use baby profile and sleep data as runtime context
- Keep the AI as the coach, not the product moat

### Safety (Non-Negotiable)
- Show a medical disclaimer in health-adjacent responses
- Redirect emergency concerns to 000 in Australia
- Only reference corpus context when possible
- Protect against prompt injection
- Keep safe sleep language aligned with Australian guidance
