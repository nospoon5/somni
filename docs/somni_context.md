# Somni – Product Context Summary

## Vision

Somni is a sleep-first baby coaching PWA for first-time parents.

Core promise:
**Better baby sleep, personalised to your baby.**

Value proposition:
**"A sleep consultant in your pocket, for a fraction of the price, available at 3am."**

---

## Target Users

### Persona 1: Anxious New Mum
- First-time mother, baby ~3 months old
- Leaning towards gentle sleep approach
- Active in Facebook parenting groups but finds conflicting advice overwhelming
- Willing to pay for clarity and reassurance
- Needs: "Tell me it's normal and what to try"

### Persona 2: Pragmatic Dad
- First-time father, baby ~6 months old
- Wants structure and quick results
- Prefers fast-track or balanced approach
- Time-poor, wants clear action steps
- Needs: "Just tell me what to do tonight"

### Persona 3: Sleep-Deprived Return-to-Work Parent
- Baby ~9-12 months old, parent going back to work
- Urgent need: baby must sleep better NOW
- Has tried free advice (Google, Facebook groups) with mixed results
- Comparing Somni to hiring a sleep consultant ($150-$500)
- Needs: "Help me fix this before Monday"

---

## Australia-First (V1) Implications

- **Timezone**: AEST/AEDT handling in sleep log timestamps
- **Date formats**: DD/MM/YYYY (not US format)
- **Units**: Metric (°C for temperature references)
- **Currency**: AUD for all pricing
- **Safe sleeping**: Red Nose Australia guidelines as the authority
- **Trusted sources**: Tresillian, Karitane, RCH Melbourne, Raising Children Network
- **Health system**: Reference GP, maternal and child health nurse, not "pediatrician" (spell "paediatrician")
- **Emergency**: 000 (not 911), Maternal and Child Health Line: 13 22 29
- **Privacy**: Must comply with Australian Privacy Principles (APP). Consider ACCC guidelines for AI products.
- **Content localisation**: Australian English spelling throughout (organised, colourful, paediatric)

---

## Core Differentiation

- Sleep-only focus (tight wedge — not tracking feeding, diapers, milestones)
- Personalised advice (based on logs + profile + sleep style)
- Coaching system (not just chat — structured responses with action steps)
- Australian-aligned sources (Red Nose, Tresillian, Karitane)
- Friendly but trustworthy tone
- AI coaching is conversational — competitors track data, Somni interprets it

---

## Core Product Loop

1. Parent logs sleep
2. Parent asks a question
3. Somni interprets:
   - baby age (age band)
   - sleep style preference (gentle/balanced/fast-track)
   - recent sleep patterns (last 3-7 days)
   - sleep score and trends
4. Somni responds with a personalised plan
5. System adapts over time as more data is logged

---

## Sleep Methodology Strategy

Somni groups approaches into 3 buckets:

### Gentle
- Responsive, low crying, high involvement
- Methods: pick-up/put-down, patting/shushing, gradual retreat

### Balanced
- Structured with check-ins
- Methods: Ferber-style timed intervals, controlled comforting

### Fast-track
- More direct, faster behaviour change, lower ongoing involvement
- Methods: Extinction-based approaches with clear boundaries

User-facing labels: **Gentle** | **Balanced** | **Fast-track**

---

## Sleep Style Questionnaire

5 questions on a 1–10 scale each.

Stores:
- `sleep_style_score` (average, 1–10)
- `sleep_style_label` (derived from score)

Mapping:
- 1–3 = Gentle
- 4–7 = Balanced
- 8–10 = Fast-track

---

## Sleep Scoring Strategy

### User Display

Status labels:
- **Improving** (75–100)
- **Steady** (55–74)
- **Needs Attention** (0–54)

Tap to reveal:
- Score (0–100)
- Strongest area
- Biggest challenge
- Tonight's focus

### Scoring Principles
- Measures baby sleep quality (not parenting quality)
- Age-aware (expectations differ by age band)
- Trend-aware (weighted: 50% last 24h, 30% last 3 days, 20% last 7 days)
- Explainable (user can understand why their score is what it is)

### Score Components
1. Night sleep quality (40 points)
2. Day sleep quality (25 points)
3. Total sleep quantity (20 points)
4. Settling ease (15 points)

### Rules
- Only count disruptive wakes
- Overnight feeds: neutral (younger babies), slightly negative (older babies)
- Contact naps = neutral (V1)

---

## Monetisation

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 10 messages/day, sleep logging, delayed sleep score (24h) |
| **Somni Plus (Monthly)** | $19.99/month (first month $9.99) | Unlimited messages, real-time score, personalised plans, trend charts |
| **Somni Plus (Annual)** | $99/year (~$8.25/mo) | Same as monthly — 58% savings vs monthly |

Revenue target: ~$10K/year (~55-60 paying subscribers)

---

## AI Strategy

- Use external model: Gemini (primary), with fallback consideration for future
- Use RAG over curated corpus (50+ chunks, Australian sources)
- Use structured baby + sleep data as runtime context
- AI is NOT the moat — corpus quality, product design, and personalisation are

### Safety (Non-Negotiable)
- Medical disclaimer in all health-adjacent responses
- Emergency detection and immediate redirect to 000
- Hallucination guardrails: only reference corpus context
- Prompt injection protection
- Red Nose Australia safe sleeping compliance
