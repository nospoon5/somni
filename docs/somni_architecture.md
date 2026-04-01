# Somni – Architecture

## System Overview

Somni is a Next.js PWA deployed on Vercel, backed by Supabase (Postgres + pgvector + Auth), using Gemini for AI responses with RAG over a curated sleep knowledge corpus.

```
┌─────────────────────────────────────────────┐
│                  Client (PWA)                │
│  Next.js App Router + Service Worker         │
│  ┌──────┐  ┌──────┐  ┌───────┐  ┌────────┐ │
│  │ Chat │  │ Sleep│  │Profile│  │Onboard │ │
│  │  UI  │  │ Log  │  │  Tab  │  │  Flow  │ │
│  └──┬───┘  └──┬───┘  └──┬────┘  └──┬─────┘ │
└─────┼─────────┼─────────┼──────────┼────────┘
      │         │         │          │
      ▼         ▼         ▼          ▼
┌─────────────────────────────────────────────┐
│           Next.js API Routes (Vercel)        │
│  /api/chat    /api/sleep   /api/profile      │
│  /api/score   /api/auth    /api/billing      │
└────┬──────────┬────────────┬────────────────┘
     │          │            │
     ▼          ▼            ▼
┌──────────┐ ┌────────────────────────────────┐
│ Gemini   │ │        Supabase                 │
│ API      │ │  ┌──────────┐  ┌────────────┐  │
│ (LLM +   │ │  │ Postgres │  │   Auth      │  │
│ Embeddings│ │  │ + pgvector│  │ (email/pw) │  │
│ )        │ │  └──────────┘  └────────────┘  │
└──────────┘ └────────────────────────────────┘
                       │
                       ▼
               ┌──────────────┐
               │   Stripe     │
               │  (Payments)  │
               └──────────────┘
```

---

## Component Architecture

### Pages (App Router)

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/` | Landing page / marketing | No |
| `/login` | Auth (sign in / sign up) | No |
| `/onboarding` | Baby profile + sleep style quiz | Yes (new users) |
| `/dashboard` | Home — sleep score + quick actions | Yes |
| `/chat` | AI coaching chat | Yes |
| `/sleep` | Sleep logging + history | Yes |
| `/profile` | Baby profile + account settings | Yes |
| `/billing` | Subscription management | Yes |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Send message → RAG → Gemini → streamed response |
| `/api/sleep` | GET/POST | CRUD sleep logs |
| `/api/score` | GET | Calculate and return sleep score |
| `/api/profile` | GET/PUT | Baby profile management |
| `/api/onboarding` | POST | Save onboarding data |
| `/api/billing/checkout` | POST | Create Stripe Checkout session |
| `/api/billing/webhook` | POST | Handle Stripe webhook events |
| `/api/billing/portal` | POST | Create Stripe Customer Portal session |

---

## Auth Architecture

- **Provider**: Supabase Auth
- **Method**: Email/password (V1). Google OAuth can be added in V2.
- **Session**: Supabase handles JWT tokens, stored in HTTP-only cookies
- **RLS**: Row Level Security on ALL user-facing tables. Users can only read/write their own data.
- **Middleware**: Next.js middleware checks auth on protected routes, redirects to `/login` if unauthenticated

---

## RAG Pipeline

### Embedding (Build Time — Stage 1)
```
Source URLs → Content Agent scrapes → Markdown chunks created
    → Gemini text-embedding-004 → Vectors stored in pgvector
```

### Retrieval (Runtime — per chat message)
```
User message
    → Embed user query (text-embedding-004)
    → pgvector cosine similarity search
    → Filter by age_band + methodology
    → Return top 5 most relevant chunks
    → Include chunk content + source attribution in prompt context
```

### Prompt Assembly
```
System Prompt (from prompt pack)
    + Runtime Context (baby profile, sleep score, recent logs)
    + Retrieved Corpus Chunks (top 5)
    + Conversation History (last 5 messages)
    + User Message
    → Send to Gemini
    → Stream response back to client
```

---

## Chat Message Flow (Detailed)

```
1. User types message in chat UI
2. Client POST /api/chat with { message, conversationId }
3. Server:
   a. Verify auth (Supabase JWT)
   b. Check usage limit (free: 10/day, paid: unlimited)
   c. Load baby profile + sleep style
   d. Load recent sleep logs (last 7 days)
   e. Calculate current sleep score
   f. Embed user message → query pgvector
   g. Retrieve top 5 relevant corpus chunks
   h. Assemble full prompt (system + context + chunks + history + message)
   i. Call Gemini API (streaming)
   j. Stream response tokens to client
   k. Save user message + AI response to messages table
   l. Increment daily usage counter
4. Client renders streamed response with typing indicator
```

---

## Sleep Score Flow

```
1. Load sleep logs for user's baby (last 7 days)
2. Split into day sleep vs night sleep
3. Calculate sub-scores:
   a. Night sleep quality (40pts): disruptive wakes, longest stretch, false starts, bedtime consistency
   b. Day sleep quality (25pts): nap count, nap duration, nap consistency
   c. Total sleep quantity (20pts): vs age band expectations
   d. Settling ease (15pts): ease-of-settling tags, self-settled ratio
4. Apply age band adjustments
5. Apply trend weighting (50% last 24h, 30% last 3 days, 20% last 7 days)
6. Compute total score (0-100)
7. Derive status label (Improving / Steady / Needs Attention)
8. Identify strongest area + biggest challenge
9. Generate "tonight's focus" recommendation
10. Cache result (invalidate on new sleep log)
```

---

## Rate Limiting & Usage Tracking

- **Counter location**: `usage_counters` table in Supabase
- **Enforcement**: Server-side in API route (NOT client-side)
- **Reset**: Daily at midnight AEST (user's timezone from profile)
- **Free tier**: 10 messages/day
- **Paid tier**: Unlimited
- **When limit hit**: Return 429 with upgrade prompt payload

---

## PWA Configuration

- **Service Worker**: Cache app shell for offline access
- **Web App Manifest**: Name, icons, theme colour, start URL
- **Install prompt**: Show "Add to Home Screen" banner after 3rd visit
- **Offline support**: Sleep logging works offline (sync when back online)
- **Push notifications**: V2 feature (not V1)

---

## Database Schema

### profiles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | = auth.users.id |
| email | text | From auth |
| created_at | timestamptz | |
| timezone | text | Default: 'Australia/Sydney' |

### babies
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| profile_id | uuid (FK → profiles) | |
| name | text | |
| dob | date | |
| biggest_issue | text | From onboarding dropdown |
| feeding_type | text | breast / bottle / mixed |
| bedtime_range | text | From onboarding dropdown |
| created_at | timestamptz | |

### onboarding_preferences
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| baby_id | uuid (FK → babies) | |
| sleep_style_score | numeric(3,1) | 1.0 – 10.0 |
| sleep_style_label | text | gentle / balanced / fast-track |
| q1–q5 answers | numeric | Individual question scores |
| created_at | timestamptz | |

### sleep_logs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| baby_id | uuid (FK → babies) | |
| started_at | timestamptz | |
| ended_at | timestamptz | Null if currently sleeping |
| is_night | boolean | Day vs night |
| tags | text[] | Array: easy, hard, short_nap, false_start, self_settled, needed_help |
| notes | text | Optional |
| created_at | timestamptz | |

### messages
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| profile_id | uuid (FK → profiles) | |
| baby_id | uuid (FK → babies) | |
| conversation_id | uuid | Groups messages into conversations |
| role | text | 'user' or 'assistant' |
| content | text | Message text |
| sources_used | jsonb | Which corpus chunks were retrieved |
| created_at | timestamptz | |

### subscriptions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| profile_id | uuid (FK → profiles) | |
| stripe_customer_id | text | |
| stripe_subscription_id | text | |
| plan | text | 'monthly' or 'annual' |
| status | text | active / cancelled / past_due |
| current_period_end | timestamptz | |
| is_trial | boolean | First month discount flag |
| created_at | timestamptz | |

### usage_counters
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| profile_id | uuid (FK → profiles) | |
| date | date | Usage date (AEST) |
| message_count | integer | Messages sent today |
| last_reset | timestamptz | |

### corpus_chunks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| chunk_id | text | Readable ID e.g. '4-6m_night_waking_01' |
| topic | text | |
| age_band | text | |
| methodology | text | gentle / balanced / fast-track / all |
| content | text | The actual chunk text |
| embedding | vector(768) | Gemini embedding vector |
| sources | jsonb | Array of {name, url} |
| confidence | text | high / medium / low |
| created_at | timestamptz | |

---

## Error Handling Strategy

| Scenario | Handling |
|----------|----------|
| AI API call fails | Show friendly error: "I'm having trouble thinking right now. Try again in a moment." Retry once automatically. |
| Stripe webhook fails | Log error, retry via Stripe's built-in retry. Check status on next user action. |
| Usage limit hit | Return structured 429 response with remaining time until reset + upgrade CTA. |
| Auth session expired | Middleware redirects to `/login`. Preserve intended destination for post-login redirect. |
| Sleep log validation fails | Client-side validation first. Server rejects invalid data with clear error messages. |
| pgvector query returns no results | Fall back to general-purpose prompt without corpus context. Flag response as "general guidance." |
| Offline (PWA) | Queue sleep log entries. Show cached data. Disable chat with "You're offline" message. |

---

## AI Response Schema

```json
{
  "message": "string — the main coaching response",
  "sources": [
    {
      "name": "Red Nose Australia",
      "topic": "safe sleeping"
    }
  ],
  "safety_note": "string | null — medical disclaimer if triggered",
  "is_emergency_redirect": false,
  "confidence": "high | medium | low"
}
```

The response is rendered as natural language in the chat UI. Sources are shown as subtle attribution below the response. Safety notes are visually distinct (warning style).
