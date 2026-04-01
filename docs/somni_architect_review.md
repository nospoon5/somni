# Somni — Architect Review

> **Role**: Senior Software Architect | **Date**: 1 April 2026

---

## 1. Document-by-Document Critique

### 1.1 [somni_context.md](file:///C:/AI%20Projects/01_Apps/Somni/somni_context.md)

**Verdict: ✅ Strong foundation, needs some tightening**

This is the strongest document in the pack. The product vision is clear, the sleep methodology buckets are well thought out, and there's good separation between what the AI does and what the product does.

**Issues to address:**

| # | Issue | Severity | Suggestion |
|---|-------|----------|------------|
| 1 | No user personas beyond "first-time parents" | Medium | Define 2–3 micro-personas (e.g. "anxious new mum, 3-month-old, leaning gentle" vs "pragmatic dad, 6-month-old, wants structure"). This directly informs prompt design and onboarding flow. |
| 2 | "Australia-first for V1" has no implications listed | Medium | Spell out what this means: timezone handling, date formats, metric units, currency (AUD), content localisation considerations for later, Safe Sleeping guidelines from Red Nose, and any ACCC/privacy compliance. |
| 3 | Sleep style questionnaire details are vague | Low | The 5 questions themselves aren't defined anywhere. These are critical to the UX — they should be drafted in the context doc or a separate UX spec. |
| 4 | Monetisation section is too thin | High | $30/month is stated without justification, comparison, or tier breakdown. See Section 4 below. |
| 5 | "AI is NOT the moat" — great insight, but the moat isn't proven yet | Low | The claimed moats (product design, sleep system, data + personalisation) are all things that don't exist yet. Acknowledge this is aspirational and define what makes them defensible once built. |

---

### 1.2 [somni_implementation_plan.md](file:///C:/AI%20Projects/01_Apps/Somni/somni_implementation_plan.md)

**Verdict: ⚠️ Good skeleton, too light on critical details**

| # | Issue | Severity | Suggestion |
|---|-------|----------|------------|
| 1 | **14-day V1 timeline is unrealistic** | 🔴 High | You're building: auth, onboarding, sleep logging, chat UI, AI integration, RAG pipeline, sleep scoring, usage limits, AND payments — in 14 days. For a beginner developer using AI tooling, a more honest estimate is **4–6 weeks** for a rough MVP. Setting an unrealistic deadline risks cutting corners on the wrong things. |
| 2 | No API route definitions | Medium | The chat flow requires at minimum 4–5 API routes (message send, sleep log CRUD, score fetch, profile fetch). These should be listed. |
| 3 | Database schema says "simplified" but has no column definitions | Medium | Table names alone aren't actionable. The Builder agent needs at minimum: column names, types, and required constraints for each table. |
| 4 | No environment / infrastructure setup steps | Medium | Supabase project creation, Vercel deployment config, Stripe webhook setup, API key management — none of this is mentioned. |
| 5 | Build order is correct but lacks dependency mapping | Low | Step 5 (AI integration) depends on step 3 (sleep logging data exists) and step 6 (corpus). Make dependencies explicit. |
| 6 | No error handling strategy | Medium | What happens when the AI call fails? When Stripe is down? When the user's message limit is hit mid-conversation? |

---

### 1.3 [somni_architecture.md](file:///C:/AI%20Projects/01_Apps/Somni/somni_architecture.md)

**Verdict: ⚠️ Good flow, but this is incomplete as an architecture doc**

This reads like a flow diagram description, not an architecture document. It's missing:

| Missing Element | Why It Matters |
|----------------|----------------|
| **Component diagram** | What are the modules? How do Next.js pages, API routes, Supabase, pgvector, and the LLM provider connect? |
| **Data flow for RAG** | How are corpus chunks embedded? When? What model creates the embeddings? How are they queried at runtime? |
| **Auth architecture** | Supabase Auth? Magic link? Email/password? OAuth? Row Level Security (RLS) policies? |
| **Rate limiting / usage tracking** | Where does the message counter live? How is it enforced (client? server? middleware?)? |
| **Caching strategy** | Sleep scores don't need recalculating on every chat message. When are they cached? Invalidated? |

> [!IMPORTANT]
> The Output Object JSON shape is a good start — but it should also define the full AI response schema (does it include markdown? Structured sections? A confidence flag?).

---

### 1.4 [somni_architect_handoff.md](file:///C:/AI%20Projects/01_Apps/Somni/somni_architect_handoff.md)

**Verdict: ⚠️ Too brief to be a useful handoff**

This file essentially duplicates the implementation plan in abbreviated form. A proper architect → builder handoff should include:

- **Exact file structure** (e.g. `/app/api/chat/route.ts`, `/app/onboarding/page.tsx`)
- **Tech decisions made** (e.g. "use Supabase Auth with email/password, not magic link")
- **Conventions** (naming, folder structure, component patterns)
- **Acceptance criteria** for each feature
- **What NOT to build** (equally important for scope control)

This needs a significant rewrite before it's useful to a Builder agent.

---

### 1.5 [somni_corpus_plan.md](file:///C:/AI%20Projects/01_Apps/Somni/somni_corpus_plan.md)

**Verdict: ✅ Good plan, needs curation workflow details**

| # | Issue | Severity | Suggestion |
|---|-------|----------|------------|
| 1 | No embedding strategy defined | High | What model creates embeddings? OpenAI `text-embedding-3-small`? Gemini embeddings? Chunk size? Overlap? This is critical for RAG quality. |
| 2 | "15–25 high-quality chunks" may be too few | Medium | For a meaningful coaching experience, you likely need 30–50+ chunks covering age bands × topics × methodologies. 15 chunks will make the AI feel repetitive fast. |
| 3 | No chunk metadata schema | Medium | Each chunk should have: `topic`, `age_band`, `methodology_alignment` (gentle/balanced/fast-track), `source`, `last_reviewed`. This enables filtered retrieval. |
| 4 | No curation workflow | Low | Who writes the chunks? AI drafts + human review? Pure manual? Define the pipeline. |
| 5 | "Paraphrase everything" is correct for copyright but needs quality control | Low | Paraphrased content can lose precision. Define a review checklist for corpus chunks. |

---

### 1.6 [somni_prompt_pack.md](file:///C:/AI%20Projects/01_Apps/Somni/somni_prompt_pack.md)

**Verdict: ⚠️ Good structure, but needs hardening**

| # | Issue | Severity | Suggestion |
|---|-------|----------|------------|
| 1 | File has markdown-inside-markdown formatting (code fence wrapper) | Low | The file wraps the actual prompt in a code block. Remove the outer fence — this should be raw markdown. |
| 2 | No safety rails in the system prompt | 🔴 High | There's no instruction to refuse harmful advice, handle emergencies ("my baby isn't breathing"), or redirect to medical professionals. **This is critical for a baby health-adjacent product.** |
| 3 | No hallucination guardrails | High | Add: "Only reference information from the provided context. If you don't have relevant information, say so honestly." |
| 4 | No prompt injection protection | Medium | Add instructions to ignore user attempts to override the system prompt or change persona. |
| 5 | "Offer 1–2 options and recommend one" is good | ✅ | Keep this — it reduces decision fatigue for tired parents. |
| 6 | Runtime context template uses placeholder `X` | Low | Define exact variable interpolation format (e.g. `{{baby_age_months}}`, `{{sleep_style_label}}`). |

> [!CAUTION]
> **A baby sleep app MUST have safety disclaimers.** The system prompt must include: "I am not a medical professional. If your baby is unwell, contact your GP or call 000. For safe sleeping guidance, refer to Red Nose Australia." This isn't optional — it's a liability issue.

---

## 2. Agent Setup Assessment

### Current Agents
Your four workflow agents (Architect, Builder, Designer, Reviewer) are correctly set up with clean handoff patterns. However, I notice two issues:

> [!WARNING]
> **The `.agent/AGENT.md` file in the Somni folder still says "Agent Rules — Japanese Learning App"** and references Hiragana/Katakana/Kanji drills. This was clearly copied from your other project and never updated. It needs to be rewritten for Somni.

**The shared agent definitions** in `C:\AI Projects\02_Shared\Agents\` were written for **Menty** (your personal AI assistant project). The Evaluator and Safety agents are Menty-specific (email drafting, Telegram, credential handling). They won't work for Somni without adaptation.

### Recommended Additional Agents

| Agent | Why You Need It | Priority |
|-------|----------------|----------|
| **Content/Corpus Agent** | Somni's RAG quality is the product. You need a dedicated agent responsible for: researching sleep sources, drafting corpus chunks, embedding them, and validating retrieval quality. None of the existing agents cover this. | 🔴 High |
| **QA/Test Agent** | Not the same as Reviewer. This agent would run end-to-end tests: "submit a sleep log, send a chat message, verify response quality, check the score updates." The Evaluator agent from your Menty project is close, but needs to be adapted for Somni's domain (sleep advice quality, safety response checks, scoring accuracy). | Medium |

I would also suggest **not** creating a Safety agent from scratch for Somni V1, but instead adding a **safety section to the Reviewer agent's checklist** that covers:
- Medical disclaimer presence in all AI responses
- Emergency detection and redirect behaviour
- Safe sleeping guideline compliance

---

## 3. Technical Viability Assessment

### Stack Assessment

| Component | Choice | Verdict |
|-----------|--------|---------|
| Next.js | ✅ | Good default. App Router + Server Actions will keep things simple. |
| Supabase | ✅ | Excellent for a solo/small team. Auth, DB, Realtime, and storage in one. |
| pgvector | ✅ | Smart — avoids a separate vector DB. Supabase supports it natively. |
| Gemini | ✅ | Reasonable starting point. Good pricing. Consider adding a fallback. |
| Stripe | ✅ | Standard choice. Stripe Checkout will get you to payment fast. |
| Vercel | ✅ | Natural pairing with Next.js. Free tier is generous for MVP. |

**Overall stack verdict: Solid, modern, well-matched.** No exotic choices, good ecosystem support, all have generous free tiers. This is buildable.

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RAG quality too low with 15–25 chunks | High | High | Start with 40+ chunks. Build a retrieval quality test suite early. |
| Sleep scoring algorithm produces nonsensical results | Medium | High | Build a test harness with known inputs → expected outputs before connecting to the UI. |
| AI latency makes chat feel slow | Medium | Medium | Stream responses. Show a "thinking" indicator. Consider edge functions. |
| Supabase free tier limits hit | Low | Medium | Monitor early. Upgrade path is straightforward. |
| Prompt injection via chat | Medium | High | Add input sanitisation + system prompt hardening. |

### Can You Build This?

**Yes, with caveats.** Given that you're a beginner developer using AI tooling:

- The stack is appropriate and well-supported
- The feature set is ambitious but not unreasonable for an MVP
- **Realistic timeline: 5–8 weeks** for a polished V1, not 14 days
- The hardest parts will be: RAG pipeline quality, sleep scoring algorithm accuracy, and prompt engineering

---

## 4. Monetisation Assessment

### Your Current Plan
- Free: limited messages/day
- Paid: $30/month (first month half price at $15)

### Problems With This Pricing

| Issue | Detail |
|-------|--------|
| **$30/month is aggressively high for the Australian market** | This positions Somni as a premium product before it has earned trust. Most parents will compare this to free advice from Tresillian, Karitane helplines, or Facebook groups. |
| **Monthly subscription creates churn pressure** | Baby sleep problems are acute — parents need help for weeks, not years. A monthly sub means you need to constantly re-justify value. |
| **No free tier value proposition defined** | "Limited messages/day" — but how many? 3? 5? If the free tier is too stingy, users won't experience enough value to convert. If it's too generous, they won't pay. |

### Recommended Pricing Model

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 5 messages/day, sleep logging, sleep score (delayed 24h), basic age-band info |
| **Somni Plus** | $14.99/month or $99/year | Unlimited messages, real-time sleep score, personalised plans, sleep trend charts, full corpus access |
| **Gift / One-time** | $49.99 for 3 months | For gifting (baby showers, new parent gifts) — removes subscription friction |

> [!TIP]
> **Consider a "sleep sprint" model**: $29.99 for a 2-week intensive coaching period. This matches how parents actually use sleep coaching — they need intensive help for a short period, not an indefinite subscription. It also reduces commitment anxiety.

---

## 5. Competitive Analysis: Somni vs Napper

### What Napper Does Well

Napper is a mature, award-winning app (Editors' Choice, App of the Day, 35,000+ 5-star reviews, 4.9 rating). Key strengths:

- **Predictive nap scheduling** — their core feature. Uses baby data to predict when the next nap should be, with push notifications 30 min before
- **Sleep sounds library** — 30+ tracks (white noise, lullabies, nature sounds)
- **Sleep course content** — educational content built into the app
- **Tracking categories** — nursing, diaper changes, bottle feeding beyond just sleep
- **Native mobile app** — iOS + Android, not a web app
- **Pricing**: $69.99/year (~$5.83/month) — significantly cheaper than your $30/month
- **Social proof**: massive review count, genuine parent testimonials
- **Polished UX**: years of iteration, multiple data points per baby

### Where Somni Can Differentiate

| Somni Advantage | Why It Matters |
|----------------|----------------|
| **AI coaching (conversational)** | Napper gives data/schedules. Somni gives advice. Parents want to ask "why is she waking at 2am?" and get a personalised answer. Napper can't do this. |
| **Sleep methodology alignment** | Napper is methodology-agnostic. Somni adapts to gentle/balanced/fast-track preferences. This is a real emotional differentiator. |
| **Australian-specific sources** | Red Nose, Tresillian, Karitane — these are trusted brands for Australian parents. Napper is a European app with generic guidance. |
| **Sleep scoring with coaching** | Napper tracks data. Somni interprets it and tells you what to do about it. The "score → coaching" loop is unique. |
| **Web-first (lower friction)** | No app store approval, no download. A sleep-deprived parent can access it instantly from any device. |

### Where Napper Has the Advantage

| Napper Advantage | Somni Challenge |
|-----------------|-----------------|
| **Native push notifications** | Web push exists but is less reliable, especially on iOS. A PWA could help. |
| **Predictive scheduling** | Somni doesn't plan to do this in V1. It's a major feature gap. |
| **Sleep sounds** | Not in Somni's scope. Could be a V2 feature or a partnership opportunity. |
| **Massive social proof** | Somni starts from zero. Content marketing and parent community building will be essential. |
| **Price** | $70/year vs $360/year (your price). Somni is 5x more expensive. This must change. |
| **Years of data/iteration** | Their algorithm is trained on millions of babies' data. Somni starts cold. |

### Head-to-Head Summary

| Dimension | Napper | Somni |
|-----------|--------|-------|
| Core value prop | Predictive sleep scheduling | AI sleep coaching |
| Format | Native mobile app | Web app |
| AI capability | None (rule-based) | LLM + RAG (conversational) |
| Personalisation | Schedule-based | Methodology + coaching |
| Content | Sleep course + sounds | Curated corpus (AU sources) |
| Pricing | ~$6/month (annual) | $30/month (proposed) |
| Market maturity | Established (5+ years) | Pre-launch |
| Tracking breadth | Sleep + feeding + diapers | Sleep only |

### My Honest Assessment

**Somni is not a Napper competitor — it's a different product.** Napper is a sleep *tracker*. Somni is a sleep *coach*. This is a meaningful distinction, and it's the right positioning.

The real competitive landscape for Somni is:
1. **Human sleep consultants** ($150–$500 per consultation in Australia)
2. **Tresillian/Karitane helplines** (free but limited, long wait times)
3. **Facebook parenting groups** (free, unvetted, anxiety-inducing)
4. **ChatGPT / generic AI** (free, no personalisation, no sleep data context)

Somni's value proposition should be: **"A sleep consultant in your pocket, for a fraction of the price, available at 3am."** That's a strong wedge.

> [!IMPORTANT]
> **Critical risk**: If the AI advice quality isn't noticeably better than "just asking ChatGPT my baby sleep question," the product has no reason to exist. The RAG corpus quality and prompt engineering are existential features, not nice-to-haves.

---

## 6. Recommended Next Steps

1. **Fix the AGENT.md** — update it from the Japanese Learning App placeholder to Somni-specific rules and context
2. **Rewrite the architect handoff** — make it actionable with file structure, tech decisions, and acceptance criteria
3. **Expand the corpus plan** — target 40+ chunks, define the embedding strategy, add metadata schema
4. **Add safety rails to the prompt pack** — medical disclaimers, emergency redirects, hallucination guardrails
5. **Revise the pricing** — bring it in line with market expectations ($10–15/month, or consider sprint pricing)
6. **Create the Content Agent** — this is your highest-leverage new agent
7. **Expand the architecture doc** — add component diagram, auth flow, RAG pipeline details
8. **Set a realistic V1 timeline** — 5–8 weeks, with milestones every 1–2 weeks

---

## Clarification Questions

Before we proceed to building, I need your input on these:

1. **Pricing**: Are you open to adjusting from $30/month? What's your minimum viable revenue target?
2. **Timeline**: Are you targeting a specific launch date, or is this "ready when it's ready"?
3. **Corpus authoring**: Do you plan to personally write/review the sleep corpus chunks, or should we define an AI-assisted curation pipeline?
4. **PWA vs pure web**: Should we build as a Progressive Web App from the start (enables push notifications, offline access, "add to home screen")?
5. **Multi-baby support**: Should the V1 data model support multiple babies per account? (Common for parents of twins or multiple children)
6. **Partner/caregiver access**: Should V1 support sharing a baby profile between two parents? Napper has this and it's frequently praised in reviews.
