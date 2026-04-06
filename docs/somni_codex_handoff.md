# Somni - Brand Refresh Handoff for Codex

## V3 Program Status Update (2026-04-06)

This handoff was originally created for brand-refresh execution. The active source of truth for current delivery is now:

- `docs/somni_implementation_plan_v3.md`

Latest execution snapshot:

- Stage 7 status: **Partially complete**
- Stage 7 Option A (SVG brand conversion): **Deferred by product decision**
- Stage 7 Option B (sleep log integrity): **Complete**
  - Migration applied: `supabase/migrations/20260406_sleep_logs_single_active_session.sql`
  - Verified constraint behavior: second open session for same baby fails with `SQLSTATE 23505`
- Stage 7 Option C (chat/billing decoupling): **Complete**
  - Updated files:
    - `src/app/chat/page.tsx`
    - `src/components/chat/ChatCoach.tsx`
    - `src/components/chat/ChatCoach.module.css`
  - Verified degraded behavior using forced billing failure (`SOMNI_FORCE_BILLING_FAILURE=1`): `/chat` returns 200 and renders read-only notice instead of 500.

Next active stage:

- Stage 8: AI Persona & Corpus Enrichment (execute strictly stage-by-stage with QC gates)

## Live Progress (Updated: 2026-04-05)

### Status Summary
- Overall: Complete (implementation + validation finished)
- Scope: Visual refresh only (no routing/API/business logic changes)

### Step Tracking
- [x] Step 1 - Font imports and root font variables (`src/app/layout.tsx`)
- [x] Step 2 - Design tokens and reusable utility classes (`src/app/globals.css`)
- [x] Step 3 - Logo/icon assets copied to `/public` and `/public/icons`
- [x] Step 4 - Landing page refresh (`src/app/page.tsx`, `src/app/page.module.css`)
- [x] Step 4 - Auth pages refresh (`src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/components/auth/*`, `src/app/auth-page.module.css`)
- [x] Step 4 - Onboarding refresh (`src/app/onboarding/*`, `src/components/onboarding/*`)
- [x] Step 4 - Dashboard refresh (`src/app/dashboard/*`)
- [x] Step 4 - Sleep refresh (`src/app/sleep/*`, `src/components/sleep/*`)
- [x] Step 4 - Chat refresh (`src/app/chat/*`, `src/components/chat/*`)
- [x] Step 4 - Legal pages refresh (`src/app/legal-page.module.css`, `/privacy`, `/terms`, `/disclaimer`)
- [x] Step 4 - Shared UI polish (bottom nav/footer/support page)
- [x] Step 4 - Profile & Billing pages implemented (`/profile`, `/billing`)
- [x] Step 5 - Manifest updated to lunar theme/icons (`src/app/manifest.ts`)
- [x] Step 6 - Optional noise texture added (`/public/noise.png`) and wired to landing background
- [ ] Step 7 - SVG logo files created (`public/somni-icon.svg`, `public/somni-logo-light.svg`, `public/somni-logo-dark.svg`)

### Notes and Assumptions
- Profile/Billing routes were added with server-rendered auth gating and existing billing/subscription data wiring.
- Existing generated icon routes (`src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/pwa/icon/[size]/route.ts`) were also restyled to match the new palette.
- The brief's CSS font-token snippet had recursive variable names; implemented equivalent non-recursive usage by consuming `next/font` variables directly in utility classes.

---
## Context

Somni is a mobile-first PWA for infant sleep coaching. This document is a complete visual refresh brief. Do NOT change any routing, API routes, server actions, Supabase queries, Stripe logic, or business logic. This is a **purely visual/CSS/typography refresh**.

All reference images are in `assets/` at the project root:
- `assets/somni_logo_full.png` Ã¢â‚¬â€ chosen full logo (icon + wordmark)
- `assets/somni_icon.png` Ã¢â‚¬â€ icon-only mark (for PWA icons, favicon)
- `assets/somni_brand_reference.png` Ã¢â‚¬â€ colour palette, typography, button/card styles
- `assets/somni_landing_reference.png` Ã¢â‚¬â€ target landing page visual reference

---

## Design Direction: Lunar Calm

**Summary:** Dark nocturnal aesthetic. Deep midnight navy background, warm cream text, lunar gold accent. Playfair Display serif for all display headlines to create a literary, human, editorial feel. DM Sans for all body/UI text. Glassmorphism-style cards with subtle gold borders. The overall feel should reference the Calm app Ã¢â‚¬â€ atmospheric, unhurried, premium but warm.

**Reference image:** `assets/somni_landing_reference.png`
- Near-black starfield background
- Large Playfair Display serif headline in warm cream
- Warm gold accent crescent moon graphic in hero
- Elevated navy feature cards with icon + text
- Lunar gold pill CTA button
- DM Sans body text in muted silver/cream

---

## Step 1 Ã¢â‚¬â€ Font Imports (`src/app/layout.tsx`)

Replace the existing Google Fonts import block with:

```tsx
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google'

const displayFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const bodyFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500'],
  display: 'swap',
})

const monoFont = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400'],
  display: 'swap',
})
```

Apply all three variables to the root `<html>` element:

```tsx
<html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
```

---

## Step 2 Ã¢â‚¬â€ Design Tokens (`src/app/globals.css`)

Replace the entire `:root` block with:

```css
:root {
  /* Backgrounds */
  --color-bg:              #0a0c1a;
  --color-surface:         #121627;
  --color-card:            #1a1e35;
  --color-card-glass:      rgba(255, 255, 255, 0.05);

  /* Text */
  --color-text:            #fef0dc;
  --color-text-muted:      #9ba3bf;
  --color-text-faint:      #5a6480;

  /* Accent */
  --color-accent:          #e8b44a;
  --color-accent-light:    #f5d987;
  --color-accent-glow:     rgba(232, 180, 74, 0.18);

  /* Borders */
  --color-border:          rgba(232, 180, 74, 0.12);
  --color-border-glass:    rgba(255, 255, 255, 0.10);
  --color-border-subtle:   rgba(255, 255, 255, 0.06);

  /* Semantic */
  --color-safety:          #d97706;
  --color-safety-bg:       rgba(217, 119, 6, 0.12);
  --color-success:         #6ee7b7;
  --color-error:           #f87171;

  /* Radius */
  --radius-sm:             8px;
  --radius-md:             14px;
  --radius-lg:             20px;
  --radius-xl:             28px;
  --radius-full:           9999px;

  /* Shadows */
  --shadow-card:           0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-accent:         0 0 24px rgba(232, 180, 74, 0.15);

  /* Typography */
  --font-display:          var(--font-display), 'Playfair Display', Georgia, serif;
  --font-body:             var(--font-body), 'DM Sans', system-ui, sans-serif;
  --font-mono:             var(--font-mono), 'DM Mono', monospace;
}
```

Update the `body` base styles:

```css
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
}
```

Add these reusable utility classes to `globals.css`:

```css
/* Typography */
.text-display {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.text-body {
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.text-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-faint);
}

.text-data {
  font-family: var(--font-mono);
  font-weight: 400;
  color: var(--color-text);
}

/* Cards */
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.card-glass {
  background: var(--color-card-glass);
  border: 1px solid var(--color-border-glass);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 2rem;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-light));
  color: #0a0c1a;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 0.9375rem;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-accent);
}

.btn-primary:active {
  transform: translateY(0);
  opacity: 0.9;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 2rem;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.9375rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border-glass);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.btn-secondary:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

/* Micro-animations */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes ring-pulse {
  0%   { box-shadow: 0 0 0 0 var(--color-accent-glow); }
  70%  { box-shadow: 0 0 0 12px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

@keyframes glow-breathe {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}

.animate-fade-up {
  animation: fade-up 0.4s ease both;
}

.animate-pulse-ring {
  animation: ring-pulse 2s ease infinite;
}
```

---

## Step 3 Ã¢â‚¬â€ Logo & Icon Assets

The logo and icon files are in `assets/`. Copy them to `/public`:

```
assets/somni_logo_full.png  Ã¢â€ â€™  public/somni_logo.png
assets/somni_icon.png       Ã¢â€ â€™  public/somni_icon.png
```

Then also create PWA icon copies:
```
public/somni_icon.png  Ã¢â€ â€™  public/icons/icon-192.png   (reference, will need resizing)
public/somni_icon.png  Ã¢â€ â€™  public/icons/icon-512.png   (reference, will need resizing)
public/somni_icon.png  Ã¢â€ â€™  public/icons/apple-touch-icon.png
```

> Note: The PNG files are concept references. For production, convert to proper PNG at the correct pixel dimensions (192Ãƒâ€”192, 512Ãƒâ€”512, 180Ãƒâ€”180). For now, use them as-is to verify placement.

---

## Step 4 Ã¢â‚¬â€ Page-by-Page Changes

### Landing Page (`src/app/page.tsx`)

This is the most important page. Reference `assets/somni_landing_reference.png` for the target visual.

**Hero section:**
- Replace the SOMNI text-only wordmark with an `<img>` tag pointing to `public/somni_logo.png`, height 36px
- Headline text: apply `text-display` class, font-size `clamp(2.5rem, 8vw, 3.5rem)`, colour `var(--color-text)`
- The existing headline copy ("Gentle, grounded infant sleep coaching for the longest nights.") is good Ã¢â‚¬â€ keep it
- Subheadline: apply `text-body` class
- Add a decorative crescent moon SVG or use `public/somni_icon.png` as a large atmospheric graphic in the top-right of the hero (position absolute, opacity 0.15, size ~200px, no interaction)

**CTA buttons:**
- "Create your account" Ã¢â€ â€™ apply `.btn-primary`
- "Sign in" Ã¢â€ â€™ apply `.btn-secondary`

**Feature cards (the three bullet points):**
- Wrap each in a `.card` div
- Add a small moon/star/shield icon above each (use inline SVG or a simple emoji as placeholder)
- Apply `text-display` at smaller size (1rem) for each feature title
- Apply `text-body` for the description

**Background:**
- Replace the current gradient with `background: var(--color-bg)`
- Add a very subtle radial gradient overlay for depth: `radial-gradient(ellipse at 60% 0%, rgba(18, 22, 39, 0.8) 0%, transparent 60%)`
- Optional: add `background-image: url('/noise.png')` at 3% opacity for the starfield grain texture effect from the reference image

**Layout:**
- The current two-column card layout is fine structurally Ã¢â‚¬â€ update colours/fonts only
- Apply `.animate-fade-up` to the headline and CTA button section

---

### Auth Pages (`src/app/login/page.tsx`, `src/app/signup/page.tsx`)

- Replace the form card background with `var(--color-card)` and `border: 1px solid var(--color-border)`
- Headline: apply `text-display`
- "Sign in" / "Create account" submit button: apply `.btn-primary`, full width
- Input fields:
  ```css
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  color: var(--color-text);
  padding: 0.875rem 1rem;
  font-family: var(--font-body);
  ```
  On focus: `border-color: var(--color-accent); outline: none;`
- Background: same as landing Ã¢â‚¬â€ `var(--color-bg)`
- Small logo at top: `public/somni_logo.png` at height 32px, centred

---

### Onboarding (`src/app/onboarding/page.tsx`)

- Step indicator: active step dot in `var(--color-accent)`, inactive in `var(--color-border)`
- Each step card: apply `.card`
- Step headline: apply `text-display`
- Navigation buttons: "Next" Ã¢â€ â€™ `.btn-primary`, "Back" Ã¢â€ â€™ `.btn-secondary`
- Slider/range inputs: accent colour `var(--color-accent)`
- Sleep style result label chips (Gentle / Balanced / Fast-track): small pill with `background: var(--color-accent-glow)`, `color: var(--color-accent)`, `border-radius: var(--radius-full)`

---

### Dashboard (`src/app/dashboard/page.tsx`)

- Page background: `var(--color-bg)`
- Sleep score card: apply `.card-glass`
  - Score number: `text-display` at 3.5rem, `color: var(--color-accent)`
  - Score ring (if present): stroke colour `var(--color-accent)`, trail `var(--color-border)`
  - Status label ("Improving" / "Steady" / "Needs Attention"): small pill in `var(--color-accent-glow)` / `color: var(--color-accent)`
- Insight cards: apply `.card`
- "Tonight's focus" label: apply `.text-label`
- Section headings: apply `text-display` at 1.25rem
- Quick action buttons: `.btn-primary`
- Add `.animate-fade-up` to cards with staggered delays:
  ```css
  .card:nth-child(1) { animation-delay: 0.05s; }
  .card:nth-child(2) { animation-delay: 0.10s; }
  .card:nth-child(3) { animation-delay: 0.15s; }
  ```

---

### Sleep Page (`src/app/sleep/page.tsx`)

- Active sleep state button/indicator: apply `.animate-pulse-ring` to the outer container
- "Currently sleeping" label: `color: var(--color-accent)`, `text-display` at small size
- Sleep log history cards: apply `.card`
- Tags (easy_settle, hard_settle, etc.): small pills with `background: var(--color-card)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-full)`
- Start/End sleep buttons: `.btn-primary`

---

### Chat Page (`src/app/chat/page.tsx`)

- Page background: `var(--color-bg)`
- Assistant message bubble: `.card-glass` with a 2px left border in `var(--color-accent)` at 40% opacity
- User message bubble: `background: var(--color-accent-glow)`, `border-radius: var(--radius-lg)`
- Safety note (when present): `background: var(--color-safety-bg)`, `border-left: 3px solid var(--color-safety)`, `border-radius: var(--radius-md)`, text in `var(--color-safety)`
- Source attribution chips: `.text-label` style, `background: var(--color-card)`, `border-radius: var(--radius-full)`
- Message input bar: `background: var(--color-surface)`, `border: 1px solid var(--color-border-subtle)`, `border-radius: var(--radius-full)`, focus state `border-color: var(--color-accent)`
- Send button: circular `.btn-primary` (40Ãƒâ€”40px)
- Premium / usage limit banner: `.card` with `border-color: var(--color-accent)` and upgrade CTA in `.btn-primary`

---

### Profile & Billing (`src/app/profile/page.tsx`, `src/app/billing/page.tsx`)

- Section cards: `.card`
- Section headings: `text-display` at 1.1rem
- Action buttons: `.btn-primary` (upgrade) and `.btn-secondary` (manage / sign out)
- Plan badge (Free / Premium): pill with appropriate colour Ã¢â‚¬â€ Free: `var(--color-border)` bg; Premium: `var(--color-accent-glow)` bg, `var(--color-accent)` text

---

### Legal Pages (`/privacy`, `/terms`, `/disclaimer`)

- Body text: `text-body` class, `max-width: 680px`, centred
- Page heading: `text-display` at 2rem
- Background: `var(--color-bg)`
- Section headings: `text-display` at 1.1rem, `color: var(--color-text)`

---

## Step 5 Ã¢â‚¬â€ PWA Manifest (`public/manifest.webmanifest` or `src/app/manifest.ts`)

Update the manifest with the new brand values:

```json
{
  "name": "Somni",
  "short_name": "Somni",
  "description": "Calm, grounded infant sleep coaching.",
  "theme_color": "#0a0c1a",
  "background_color": "#0a0c1a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Step 6 Ã¢â‚¬â€ Optional Noise Texture

To achieve the subtle starfield grain seen in the landing reference, add a noise texture to `/public/noise.png` (a 200Ãƒâ€”200px transparent PNG with 5% monochrome grain) and reference it as:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url('/noise.png');
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
}
```

---

## Step 7 — SVG Logo Files

**Why SVG:** The PNG logos in `assets/` have a solid background and cannot be made transparent cleanly from raster processing. SVG gives crisp, infinitely scalable logos at every size with true transparency. These are used in the nav bar, auth page headers, and anywhere the logo sits on the app's dark background.

**Reference image for the illustration style:** `assets/somni_logo_full.png`
- A warm golden crescent moon (`#e8b44a`)
- A cute sleeping baby cartoon lying on the top of the crescent, rendered in cream/ivory (`#fef0dc`) with a visible round head, chubby cheeks, closed eyes, and a small curved body
- Dark navy rounded-square tile background (`#0a0c1a`) for the app icon version

---

### File 1: `public/somni-icon.svg`

The standalone icon mark — the full app icon tile with navy background. Used in the nav bar and anywhere a square icon tile is needed.

Create this file with the following structure. The baby illustration should be a simplified but recognisable vector cartoon — prioritise a round head, gentle closed eyes (two small arcs), and a curved body resting on the moon. Use the reference image `assets/somni_logo_full.png` as the visual guide.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- Navy rounded square background -->
  <rect width="100" height="100" rx="22" ry="22" fill="#0a0c1a"/>

  <!-- Crescent moon: large circle minus smaller circle via clip -->
  <!-- Moon body — large arc -->
  <circle cx="46" cy="52" r="30" fill="#e8b44a"/>
  <!-- Cutout to make crescent -->
  <circle cx="58" cy="45" r="26" fill="#0a0c1a"/>

  <!--
    Baby illustration — simplified cartoon sleeping on the crescent.
    Reference: assets/somni_logo_full.png
    Build from these approximate shapes:
    - Round head: cream circle ~r=10 centred ~(38, 34)
    - Body: cream ellipse/oval slightly below and right of head, rotated to follow the moon curve
    - Closed eyes: two small dark arcs on the face
    - Cheeks: two tiny circles slightly pink/warm, below the eyes
    Draw the baby lying along the top-right curve of the crescent.
    Keep it simple — 6 to 10 shapes total. Cute, not detailed.
  -->

  <!-- Baby head -->
  <circle cx="38" cy="34" r="10" fill="#fef0dc"/>
  <!-- Baby body -->
  <ellipse cx="52" cy="40" rx="12" ry="8" fill="#fef0dc" transform="rotate(-20, 52, 40)"/>
  <!-- Eyes — two gentle closed arcs -->
  <path d="M34 33 Q36 31 38 33" stroke="#3d2314" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <path d="M39 33 Q41 31 43 33" stroke="#3d2314" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <!-- Soft cheek blush -->
  <circle cx="34" cy="36" r="2.5" fill="#f4a57a" opacity="0.4"/>
  <!-- Small hair tuft -->
  <path d="M36 25 Q38 21 40 25" stroke="#d4a060" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>
```

> **Important:** The SVG above is a starting scaffold. Codex should refine the baby illustration to closely match the reference image `assets/somni_logo_full.png` — in particular ensuring the baby clearly reads as an infant (round chubby head, closed eyes, body curled on the moon). Adjust path coordinates and shapes until it looks warm and recognisable. The moon crescent approach (two circles) can be replaced with a proper SVG `path` arc if clip-path is simpler.

---

### File 2: `public/somni-logo-light.svg`

Horizontal lockup for use on **dark backgrounds** (the app's night theme). Icon tile on the left, "somni" wordmark in cream on the right. No subtitle text.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 60" width="220" height="60">
  <!-- Icon tile — scaled version of somni-icon.svg at 60x60 -->
  <g transform="scale(0.6) translate(0, 0)">
    <rect width="100" height="100" rx="22" ry="22" fill="#0a0c1a"/>
    <circle cx="46" cy="52" r="30" fill="#e8b44a"/>
    <circle cx="58" cy="45" r="26" fill="#0a0c1a"/>
    <circle cx="38" cy="34" r="10" fill="#fef0dc"/>
    <ellipse cx="52" cy="40" rx="12" ry="8" fill="#fef0dc" transform="rotate(-20, 52, 40)"/>
    <path d="M34 33 Q36 31 38 33" stroke="#3d2314" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M39 33 Q41 31 43 33" stroke="#3d2314" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <circle cx="34" cy="36" r="2.5" fill="#f4a57a" opacity="0.4"/>
    <path d="M36 25 Q38 21 40 25" stroke="#d4a060" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </g>

  <!-- Wordmark: "somni" in cream, DM Sans / system sans-serif -->
  <text
    x="75"
    y="38"
    font-family="'DM Sans', 'Nunito', system-ui, sans-serif"
    font-size="28"
    font-weight="600"
    fill="#fef0dc"
    letter-spacing="-0.5"
  >somni</text>
</svg>
```

---

### File 3: `public/somni-logo-dark.svg`

Horizontal lockup for use on **light backgrounds**. Same layout but wordmark text is dark navy `#0a0c1a`. Background is transparent.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 60" width="220" height="60">
  <!-- Same icon tile as light version -->
  <g transform="scale(0.6) translate(0, 0)">
    <rect width="100" height="100" rx="22" ry="22" fill="#0a0c1a"/>
    <circle cx="46" cy="52" r="30" fill="#e8b44a"/>
    <circle cx="58" cy="45" r="26" fill="#0a0c1a"/>
    <circle cx="38" cy="34" r="10" fill="#fef0dc"/>
    <ellipse cx="52" cy="40" rx="12" ry="8" fill="#fef0dc" transform="rotate(-20, 52, 40)"/>
    <path d="M34 33 Q36 31 38 33" stroke="#3d2314" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M39 33 Q41 31 43 33" stroke="#3d2314" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <circle cx="34" cy="36" r="2.5" fill="#f4a57a" opacity="0.4"/>
    <path d="M36 25 Q38 21 40 25" stroke="#d4a060" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </g>

  <!-- Wordmark in dark navy for light backgrounds -->
  <text
    x="75"
    y="38"
    font-family="'DM Sans', 'Nunito', system-ui, sans-serif"
    font-size="28"
    font-weight="600"
    fill="#0a0c1a"
    letter-spacing="-0.5"
  >somni</text>
</svg>
```

---

### Where to use each file

| File | Use in |
|---|---|
| `public/somni-icon.svg` | Favicon fallback, inline icon anywhere a square mark is needed |
| `public/somni-logo-light.svg` | Nav bar on dark pages, auth page header, landing page header |
| `public/somni-logo-dark.svg` | Any marketing materials or pages with a light/white background |

### Update logo references in the app

Anywhere the existing code uses `public/somni_logo.png` or `public/somni_icon.png`, replace with the SVG equivalents:

```tsx
// Nav bar / page headers (dark background context)
<img src="/somni-logo-light.svg" alt="Somni" height={32} />

// If used on a light background
<img src="/somni-logo-dark.svg" alt="Somni" height={32} />

// Standalone icon mark
<img src="/somni-icon.svg" alt="Somni" width={40} height={40} />
```

### Verification for Step 7

- [ ] `public/somni-icon.svg` exists and renders the crescent moon + baby illustration matching `assets/somni_logo_full.png` reference
- [ ] `public/somni-logo-light.svg` renders cleanly on the dark `#0a0c1a` background — cream wordmark, no background fill
- [ ] `public/somni-logo-dark.svg` renders cleanly on white — dark navy wordmark, no background fill
- [ ] Nav bar, landing header, login header, signup header all updated to use SVG versions
- [ ] `npm run lint` and `npm run build` still pass after changes

---

## Verification Checklist

After completing all changes, verify:

- [x] `npm run lint` passes (0 errors; 2 non-blocking `<img>` optimization warnings)
- [x] `npm run build` passes
- [x] Landing page uses Playfair Display serif headline + lunar gold pill CTA
- [x] All cards use `var(--color-card)` or `var(--color-card-glass)` backgrounds
- [x] Logo renders at top of landing, login, and signup pages
- [x] No hardcoded `#1a1a2e` / `#e8d5b5` or similar old colours remain
- [x] Dashboard score number is in `var(--color-accent)`
- [x] Active sleep state has pulse ring animation
- [x] Safety notes in chat are amber-tinted, not default card style
- [x] PWA icons are referenced in manifest correctly
- [ ] Mobile viewport (390px) looks correct for all main pages (manual browser QA still required)
