# Somni – Architect Handoff to Builder

> This document provides everything the Builder agent needs to start implementation.

---

## Build Objective

Create a V1 PWA for personalised baby sleep coaching, targeting Australian first-time parents.

---

## Tech Decisions (Already Made)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 14+ (App Router) | Server components, API routes, excellent Vercel integration |
| Hosting | Vercel | Auto-deploy from GitHub, edge functions, free tier generous |
| Database | Supabase (Postgres) | Auth + DB + Realtime in one, Row Level Security |
| Vector store | pgvector (Supabase extension) | No separate vector DB needed |
| Auth | Supabase Auth (email/password) | Simple, built-in RLS integration |
| AI model | Gemini (via Google AI SDK) | Good pricing, streaming support |
| Embeddings | Gemini `text-embedding-004` | Consistent with LLM provider |
| Payments | Stripe (Checkout + Customer Portal) | Industry standard for subscriptions |
| Styling | CSS (vanilla) with design system | No Tailwind — keep it simple and controlled |
| PWA | next-pwa or custom service worker | Installable, offline sleep logging |
| State | React Server Components + minimal client state | Avoid Redux/Zustand complexity |

---

## File Structure

```
somni/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 ← Root layout (fonts, metadata, auth provider)
│   │   ├── page.tsx                   ← Landing page (marketing)
│   │   ├── login/
│   │   │   └── page.tsx               ← Sign in / Sign up
│   │   ├── onboarding/
│   │   │   └── page.tsx               ← Multi-step onboarding flow
│   │   ├── dashboard/
│   │   │   └── page.tsx               ← Home: sleep score + quick actions
│   │   ├── chat/
│   │   │   └── page.tsx               ← AI coaching chat
│   │   ├── sleep/
│   │   │   └── page.tsx               ← Sleep logging + history
│   │   ├── profile/
│   │   │   └── page.tsx               ← Baby profile + account settings
│   │   ├── billing/
│   │   │   └── page.tsx               ← Subscription management
│   │   └── api/
│   │       ├── chat/
│   │       │   └── route.ts           ← POST: message → RAG → Gemini → stream
│   │       ├── sleep/
│   │       │   └── route.ts           ← GET/POST: sleep log CRUD
│   │       ├── score/
│   │       │   └── route.ts           ← GET: calculate sleep score
│   │       ├── profile/
│   │       │   └── route.ts           ← GET/PUT: baby profile
│   │       ├── onboarding/
│   │       │   └── route.ts           ← POST: save onboarding data
│   │       └── billing/
│   │           ├── checkout/
│   │           │   └── route.ts       ← POST: create Stripe checkout session
│   │           ├── webhook/
│   │           │   └── route.ts       ← POST: Stripe webhook handler
│   │           └── portal/
│   │               └── route.ts       ← POST: create Stripe portal session
│   ├── components/
│   │   ├── ui/                        ← Reusable UI primitives (Button, Input, Card, etc.)
│   │   ├── chat/                      ← Chat-specific components (MessageBubble, ChatInput)
│   │   ├── sleep/                     ← Sleep logging components (SleepTimer, LogEntry)
│   │   ├── onboarding/               ← Onboarding step components
│   │   └── layout/                   ← Nav, TabBar, Header, etc.
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              ← Browser Supabase client
│   │   │   ├── server.ts              ← Server Supabase client
│   │   │   └── middleware.ts          ← Auth middleware
│   │   ├── ai/
│   │   │   ├── gemini.ts              ← Gemini API wrapper
│   │   │   ├── rag.ts                 ← RAG retrieval logic
│   │   │   └── prompt.ts             ← Prompt assembly
│   │   ├── scoring/
│   │   │   └── sleep-score.ts         ← Sleep scoring algorithm
│   │   ├── stripe/
│   │   │   └── client.ts             ← Stripe client + helpers
│   │   └── utils/
│   │       ├── age-bands.ts           ← Age band definitions + helpers
│   │       └── dates.ts              ← Timezone-aware date utilities
│   ├── styles/
│   │   ├── globals.css                ← CSS custom properties, design tokens
│   │   └── components/               ← Component-specific styles
│   └── types/
│       └── index.ts                   ← TypeScript type definitions
├── public/
│   ├── manifest.json                  ← PWA manifest
│   ├── sw.js                          ← Service worker
│   └── icons/                         ← App icons (various sizes)
├── docs/                              ← Planning & architecture docs
├── corpus/                            ← Knowledge base chunks + sources
├── agents/                            ← Somni-specific agent definitions
├── .env.local                         ← Environment variables (NOT committed)
├── .gitignore
├── package.json
├── next.config.js
├── tsconfig.json
└── README.md
```

---

## Conventions

### Naming
- Files: `kebab-case.ts` (e.g. `sleep-score.ts`)
- Components: `PascalCase.tsx` (e.g. `MessageBubble.tsx`)
- CSS: BEM-style classes (e.g. `.chat-message`, `.chat-message--user`)
- Database columns: `snake_case`
- API routes: `kebab-case`

### Component Patterns
- Server Components by default. Add `'use client'` only when needed (interactivity, hooks).
- Keep components small and focused. One component = one job.
- Props over global state. Pass data down, don't reach across the tree.

### Error Handling
- API routes: Always return structured JSON `{ error: string, code: string }` on failure.
- Client: Show user-friendly error messages. Never expose technical errors.
- Use try/catch in all API routes and async operations.

---

## What NOT to Build (V1)

These are explicitly out of scope for V1:

- ❌ Multi-baby support (data model supports it, but UI is single-baby)
- ❌ Partner/caregiver sharing (V2)
- ❌ Push notifications (V2 — PWA supports it but skip for V1)
- ❌ Sleep sounds / white noise
- ❌ Predictive nap scheduling
- ❌ Feeding / diaper tracking
- ❌ Social features
- ❌ Google/Apple OAuth (V2)
- ❌ Dark mode (V2 — design for light mode first)
- ❌ Multi-language support
- ❌ Native mobile apps

---

## Acceptance Criteria (per feature)

### Auth
- [ ] User can sign up with email/password
- [ ] User can log in
- [ ] User can log out
- [ ] Invalid credentials show clear error
- [ ] Protected routes redirect to `/login`
- [ ] Session persists across page refreshes

### Onboarding
- [ ] New users are redirected to onboarding after first login
- [ ] Multi-step flow: baby details → sleep style quiz → done
- [ ] All fields validate before advancing
- [ ] Sleep style score calculated and stored
- [ ] Completed onboarding flag prevents re-showing

### Sleep Logging
- [ ] User can start a sleep timer (tap to start)
- [ ] User can end a sleep timer (tap to end)
- [ ] Day/night auto-detected based on time (with manual override)
- [ ] Optional tags can be added (easy, hard, short nap, etc.)
- [ ] Sleep history shows recent logs in reverse chronological order
- [ ] Logs are baby-specific and user-scoped (RLS)

### Chat
- [ ] Message input with send button
- [ ] Messages display in conversation format (user + assistant)
- [ ] AI response streams in real-time (token by token)
- [ ] "Thinking" indicator while waiting for first token
- [ ] Source attribution shown subtly below AI responses
- [ ] Safety disclaimers render visually distinct
- [ ] Emergency queries trigger immediate redirect response
- [ ] Usage counter visible (free users): "7 of 10 messages used today"

### Sleep Score
- [ ] Score calculates correctly for test data sets across all age bands
- [ ] Score updates when new sleep log is added
- [ ] Dashboard shows status label + score + details on tap
- [ ] Trend direction indicated (improving / declining / stable)

### Payments
- [ ] Free user sees upgrade prompt when limit reached
- [ ] Stripe Checkout opens correctly for monthly + annual plans
- [ ] First month charged at $9.99 (50% discount)
- [ ] Subscription status reflected immediately after payment
- [ ] User can manage subscription (cancel) via Stripe portal
- [ ] Cancelled users retain access until period end

---

## Environment Variables Required

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini
GEMINI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_MONTHLY_PRICE_ID=
STRIPE_ANNUAL_PRICE_ID=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Designer Handoff

### UX Requirements
- **Mobile-first** design (used at 3am, one-handed, in the dark)
- **Tab navigation**: Chat | Sleep | Profile (bottom tabs, thumb-reachable)
- **Warm, calm colour palette** — no harsh corporate blues. Think: soft purples, warm neutrals, gentle gradients
- **Large touch targets** — minimum 44px tap areas
- **Dark-mode friendly** colours (even if V1 is light-only, pick colours that will transition)
- **Typography**: Clean, highly readable. Consider Inter or similar.
- **Sleep logging**: Must be < 3 taps to start logging. Speed is everything at 3am.
- **Chat**: Clean message bubbles. AI responses should feel personal, not robotic.

### Key Screens (in priority order)
1. Chat screen (primary interaction)
2. Dashboard (sleep score + status)
3. Sleep logging (start/stop timer)
4. Onboarding flow (first-run experience)
5. Landing page (marketing / signup)

---

## Reviewer Handoff

### What to Double-Check
- [ ] RLS policies on all tables — verify users cannot access other users' data
- [ ] API routes validate auth on every request
- [ ] No API keys or secrets in client-side code
- [ ] Medical disclaimer appears in system prompt and relevant responses
- [ ] Emergency detection actually works (test with: "my baby isn't breathing")
- [ ] Prompt injection attempts are handled (test with: "ignore all previous instructions")
- [ ] Free tier limit cannot be bypassed via API calls
- [ ] Stripe webhook signature validation is implemented
- [ ] No console.log with sensitive data in production
- [ ] Error messages don't leak internal details
