# Somni Implementation Plan v6

## Purpose

This plan addresses all UI and UX feedback raised in
`docs/Somni Improvement System Notes 1.2.md` (SIS 1.2), cross-referenced against the screenshots
in `archive/SIS5` through `archive/SIS9`, plus additional UX observations identified during the
planning review.

It is designed to be used one section at a time in separate Codex chats so each work stream stays
focused and the context window stays small.

## How To Use This Plan

Start a new chat for each numbered section below.

In each new chat:

1. Link this plan file and the relevant section name.
2. Read the relevant source files listed in the section before touching any code.
3. Require all quality gates to pass before the work is considered done.
4. Do not start the next section until the current section is genuinely complete.

## Pre-Flight Check (Before Starting Any Section)

Always run these before touching code:

```
npm run lint
npm test -- --run
npm run build
```

All three must be green before and after every section.

## Test Credentials

See `docs/TEST_ACCOUNTS.md` for the pre-created test account.
Do NOT sign up a new user. Always use the pre-created test credentials.

---

## Section 1 — Chat Header: Merge Cards and Remove "Status: inactive"

**SIS reference:** SIS5
**Screenshot:** `archive/SIS5.png`

**Current state:** The `/chat` page opens with two separate cards — a "Chat" header card, then a
"Plan" card below it. Free users see "Status: inactive" in the Plan card.

**Desired state:** One single card combining the title, subtitle, quota info, and Back to
Dashboard link. "Status: inactive" is gone entirely.

### Goal

Reduce the visual noise at the top of `/chat` before the user has typed a single message.

### Relevant Files

- `src/app/chat/page.tsx`
- `src/components/chat/ChatCoach.tsx`
- `src/components/chat/ChatCoach.module.css`
- `src/app/chat/page.module.css`

### Detailed Steps

**`src/app/chat/page.tsx`**

1. Remove the standalone `<section className={styles.header} card>` JSX block (the separate card
   rendering the title, subtitle, and Back to Dashboard link). Do not delete the content — move
   it (see step 3).

**`src/components/chat/ChatCoach.tsx`**

2. Add three new props to `ChatCoachProps`:
   ```ts
   pageEyebrow: string       // e.g. "Chat"
   pageTitle: string         // e.g. "Sleep coaching for Elly"
   pageSubtitle: string      // short version, see step 4
   ```
3. At the top of the component's JSX (before the thread), replace the existing
   `planCard` section with a **single merged header card** that renders in order:
   - Eyebrow: `pageEyebrow` (`.text-label`)
   - H1: `pageTitle` (`.text-display`)
   - Subtitle: `pageSubtitle` (`.text-body`)
   - Quota line: free users → "Free plan · 10 chats per day"; premium → "Premium access active"
   - Back to Dashboard `<Link>` (carry over from the old page header)
4. The new subtitle passed from the page should be:
   `"Ask Somni anything about {babyName}'s sleep."`
   (replaces the longer "Ask one question at a time…" copy)
5. Remove `<p className={styles.planMeta}>Status: {subscriptionStatus}</p>` entirely.
6. Verify that no `'Somni Coach'` string exists anywhere in ChatCoach.tsx — the role label on
   line ~496 should already read `'Somni'`. Fix if it does not.

**`src/components/chat/ChatCoach.module.css`**

7. Rename `.planCard` to `.headerCard` to match its new merged purpose. Update the JSX class
   reference to match.

**`src/app/chat/page.tsx`**

8. Pass the three new props down to `<ChatCoach>`.

### Quality Gates

- `/chat` renders a single header card (not two)
- "Status: inactive" does not appear anywhere on the page
- No `'Somni Coach'` string in the rendered HTML
- Back to Dashboard link visible inside the merged card
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes
- Test at 375px mobile viewport — card must not overflow

### Completed Work

- `src/app/chat/page.tsx`: Removed the standalone chat header card and passed `pageEyebrow`, `pageTitle`, and `pageSubtitle` into `ChatCoach` without changing chat/billing logic.
- `src/components/chat/ChatCoach.tsx`: Added `pageEyebrow`, `pageTitle`, and `pageSubtitle` props; replaced the top plan card with one merged header card (eyebrow, title, subtitle, quota line, Back to Dashboard link); removed `Status: {subscriptionStatus}`.
- `src/components/chat/ChatCoach.module.css`: Renamed `.planCard` to `.headerCard` and updated styles for the merged header card.
- `src/components/sleep/DaySleepProgress.tsx`: Refactored timer state updates to fix the pre-existing lint blocker (`react-hooks/set-state-in-effect`) so quality gates can pass.

---

## Section 2 — Chat Bubbles: WhatsApp-style Layout

**SIS reference:** SIS5 + SIS5A
**Screenshots:** `archive/SIS5.png` (current), `archive/SIS5A.png` (target)

**Current state:** Every message (both Somni and user) is a full-width card block. The distinction
between the two is only a subtle background tint difference.

**Desired state:** True chat-bubble layout. Somni bubbles left-aligned at max 80% width. User
bubbles right-aligned at max 80% width. Input area sticky at page bottom.

### Goal

Make the chat feel like a familiar messaging app. The WhatsApp mental model is already wired in
for the target parent persona — this removes cognitive load and makes it instantly clear who said
what.

### Relevant Files

- `src/components/chat/ChatCoach.module.css`
- `src/components/chat/ChatCoach.tsx`

### Design Spec

**Somni (assistant) bubbles**
- Left-aligned (`align-self: flex-start`)
- Max-width: 80% desktop, 88% mobile
- Background: `var(--color-card)`
- Border: `1px solid var(--color-border-glass)`
- Border radius: `var(--radius-lg)` on all corners **except** bottom-left = `4px` (the "tail")
- Box shadow: `var(--shadow-card)`

**User bubbles**
- Right-aligned (`align-self: flex-end`)
- Max-width: 80% desktop, 88% mobile
- Background: `var(--color-accent-glow)`
- Border: `1px solid var(--color-border)`
- Border radius: `var(--radius-lg)` on all corners **except** bottom-right = `4px`
- Box shadow: `var(--shadow-card)`

**"Ask Somni" label**
- Move the `<label>` to use the `sr-only` global class (accessible but visually hidden).
  The placeholder text communicates context sufficiently.

**Form / input area**
- `position: sticky; bottom: 0` on the `.form` wrapper
- Background: `var(--color-bg)` so it sits cleanly above the thread on scroll
- `padding-bottom: env(safe-area-inset-bottom, 0.5rem)` for iOS safe area

### Detailed Steps

**`src/components/chat/ChatCoach.module.css`**

1. Replace `.thread`:
   ```css
   .thread {
     display: flex;
     flex-direction: column;
     gap: 0.65rem;
   }
   ```
2. Replace `.assistantBubble`:
   ```css
   .assistantBubble {
     align-self: flex-start;
     max-width: 80%;
     background: var(--color-card);
     border: 1px solid var(--color-border-glass);
     border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px;
     padding: 0.9rem 1rem;
     box-shadow: var(--shadow-card);
   }
   ```
3. Replace `.userBubble`:
   ```css
   .userBubble {
     align-self: flex-end;
     max-width: 80%;
     background: var(--color-accent-glow);
     border: 1px solid var(--color-border);
     border-radius: var(--radius-lg) var(--radius-lg) 4px var(--radius-lg);
     padding: 0.9rem 1rem;
     box-shadow: var(--shadow-card);
   }
   ```
4. Update `.form`:
   ```css
   .form {
     position: sticky;
     bottom: 0;
     background: var(--color-bg);
     padding: 0.75rem 0 env(safe-area-inset-bottom, 0.5rem);
     display: grid;
     gap: 0.5rem;
   }
   ```
5. Inside the existing `@media (max-width: 700px)` block, add:
   ```css
   .assistantBubble,
   .userBubble {
     max-width: 88%;
   }
   ```

**`src/components/chat/ChatCoach.tsx`**

6. Change the `<label>` element's `className` attribute from
   `${styles.label} text-label` to just `sr-only`.

### Quality Gates

- Somni messages left-aligned, user messages right-aligned
- Max-width 80% desktop, 88% mobile for each bubble
- Textarea sticky at page bottom on both desktop and mobile
- "Ask Somni" label hidden visually, present in DOM for accessibility
- Loading dots still animating during pending response
- Source chips still appear below assistant messages
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Completed Work

- `src/components/chat/ChatCoach.module.css`: Replaced the thread and bubble layout with left/right WhatsApp-style bubbles, updated bubble widths and borders to match the Section 2 spec, and made the chat form sticky with the requested background and iOS safe-area padding.
- `src/components/chat/ChatCoach.tsx`: Switched the "Ask Somni" form label to the global `sr-only` class so it stays accessible while being visually hidden.
- `docs/somni_implementation_plan_v6.md`: Added this Section 2 completion summary and recorded the exact files changed.

---

## Section 3 — Dashboard Header Declutter

**SIS reference:** SIS6
**Screenshot:** `archive/SIS6.png`

**Current state:** Dashboard shows: "DASHBOARD" eyebrow, "Welcome, Damien Yong.", subtitle copy,
two large pill buttons (Log sleep / Ask Somni), "Sign out" button top-right.

**Desired state:** Greeting changes to "Hi, [FirstName].", subtitle removed, Sign out removed,
action buttons replaced with small pill quick-links labelled exactly as the bottom nav.

### Relevant Files

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/page.module.css`

### Detailed Steps

**`src/app/dashboard/page.tsx`**

1. Extract first name from `profile.full_name` (split on whitespace, take index 0).
   Change title: `Welcome, ${full_name}.` → `Hi, ${firstName}.`
   Fallback if no name: `Hi there.`

2. Delete the subtitle `<p>` entirely:
   ```tsx
   // DELETE:
   <p className={`${styles.subtitle} text-body`}>
     A calm snapshot of the last week, plus the fastest next steps for tonight.
   </p>
   ```

3. Delete the Sign out `<form>` from the header:
   ```tsx
   // DELETE:
   <form action={logoutAction}>
     <button className="btn-secondary" type="submit">Sign out</button>
   </form>
   ```
   Sign out should be accessible via the Profile page only.
   Remove the `logoutAction` import if it is no longer referenced anywhere in the file.

4. Replace the two `<Link className="btn-primary">` buttons with small pill-style quick-links.
   Labels must match the bottom nav exactly: **"Sleep"** and **"Chat"**.
   Apply new class `styles.quickLink` to each.

**`src/app/dashboard/page.module.css`**

5. Remove or comment out the `.subtitle` block.
6. Replace `.actions` with a flex version:
   ```css
   .actions {
     display: flex;
     flex-wrap: wrap;
     gap: 10px;
     margin-top: 14px;
   }
   ```
7. Add `.quickLink`:
   ```css
   .quickLink {
     display: inline-flex;
     align-items: center;
     gap: 6px;
     padding: 6px 16px;
     border-radius: var(--radius-full);
     border: 1px solid var(--color-border-glass);
     color: var(--color-text);
     font-size: 0.9rem;
     transition: border-color 0.15s ease, background 0.15s ease;
   }
   .quickLink:hover {
     border-color: var(--color-accent);
     background: var(--color-accent-glow);
   }
   ```

### Quality Gates

- H1 reads "Hi, [FirstName]." not full name
- No subtitle paragraph
- No Sign out button in the dashboard header
- Two small pill links labelled "Sleep" and "Chat" visible in the actions area
- Labels match the bottom nav exactly
- `logoutAction` import removed (no unused-import lint warning)
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Completed Work

- `src/app/dashboard/page.tsx`: Updated the dashboard H1 to use first-name greeting (`Hi, [FirstName].`) with `Hi there.` fallback, removed the subtitle paragraph, removed the header Sign out form and `logoutAction` import, and replaced the two large action buttons with `Sleep` and `Chat` quick-links.
- `src/app/dashboard/page.module.css`: Removed the `.subtitle` styles, replaced `.actions` with the requested flex-wrap pill layout, and added `.quickLink`/`.quickLink:hover` styles exactly as specified for the new quick-links.
- `docs/somni_implementation_plan_v6.md`: Added this Section 3 completion summary and recorded the exact files changed.

---

## Section 4 — DailyPlanPanel: Copy Overhaul + Static Baseline Plans

**SIS reference:** SIS7
**Screenshot:** `archive/SIS7.png`

**Baseline plan approach: Option A (confirmed)**
Static JSON template files keyed by baby age band, stored in `src/lib/baseline-plans/`.
No AI call required. The dashboard page reads the baby's age and selects the right template.

**Current state:**
- Section label "TODAY'S DASHBOARD PLAN"
- "Empty state" badge top-right
- Empty-state body includes "shared source of truth" and "Tomorrow starts clean" — corporate copy
- "Current focus" and "Recent activity" boxes below the plan panel

**Desired state:**
- Section label: "Today's plan"
- No badge
- On first load (no existing plan), immediately show a baseline plan from the static templates
- The plan note reads: "Here's Somni's customised baseline plan to help [babyName] start sleeping
  better. Somni will adjust it as we learn more and as your baby grows and develops."
- "Current focus" and "Recent activity" boxes removed

### Relevant Files

- `src/components/dashboard/DailyPlanPanel.tsx`
- `src/components/dashboard/DailyPlanPanel.module.css`
- `src/app/dashboard/page.tsx`
- New: `src/lib/baseline-plans/` (directory + files, see below)

### Detailed Steps

**`src/components/dashboard/DailyPlanPanel.tsx`**

1. Change the kicker label from `Today's dashboard plan` to `Today's plan`.
2. Remove `<span className={styles.badge}>` (the "Empty state" / "Active plan" badge).
3. In the empty-state branch, replace the body copy and steps:
   - Remove step 3 "Tomorrow starts clean".
   - Replace the introductory paragraph with:
     `"Here's Somni's customised baseline plan to help {babyName} start sleeping better. Somni will adjust it as we learn more and as your baby grows and develops."`
4. When `initialPlan` is a baseline plan (i.e. still no AI-generated plan), display it using
   the same active-plan layout. The empty-state branch should only appear if `initialPlan` is
   truly `null` (no baby found, or baseline lookup failed).

**`src/app/dashboard/page.tsx`**

5. Import `getBaselinePlan` from `@/lib/baseline-plans`.
6. If `dailyPlan` is `null` after the Supabase fetch:
   - Calculate the baby's age in weeks from `baby.date_of_birth`.
   - Call `getBaselinePlan(ageInWeeks, baby.name)`.
   - Pass the result as `initialPlan` to `<DailyPlanPanel>`.
7. Delete the "Current focus" and "Recent activity" `<article>` elements and the enclosing
   `<div className={styles.grid}>`.
8. Remove the `.grid` and `.panel` CSS references from `page.module.css` if they are now unused.

**New: `src/lib/baseline-plans/index.ts`**

9. Export a function:
   ```ts
   export function getBaselinePlan(ageInWeeks: number, babyName: string): DailyPlanRecord
   ```
   that reads from the static templates below and returns the best-match plan, with the `notes`
   field personalised to include `babyName`.

**New: `src/lib/baseline-plans/templates/`**

10. Author seven JSON template files. Each must be a valid `DailyPlanRecord`-compatible object.
    Age band assignments:

    | File | Age | Nap count | Wake windows |
    |------|-----|-----------|--------------|
    | `0-8wk.json` | 0–8 weeks | Demand-led | 45–60 min |
    | `8-16wk.json` | 8–16 weeks | ~4 naps | 60–90 min |
    | `16-28wk.json` | 16–28 weeks | 3–4 naps | 90–120 min |
    | `28-40wk.json` | 28–40 weeks | 3 naps | ~2 hr |
    | `40-52wk.json` | 40–52 weeks | 2 naps | ~2.5 hr |
    | `52-78wk.json` | 52–78 weeks | 2 naps → 1 | ~3 hr |
    | `78wk-plus.json` | 78+ weeks | 1 nap | 4–5 hr |

    Each template's `notes` field should be the placeholder string:
    `"Here's Somni's customised baseline plan to help {{babyName}} start sleeping better. Somni will adjust it as we learn more and as your baby grows and develops."`
    (The `{{babyName}}` token is replaced at runtime by `getBaselinePlan`.)

**`src/components/dashboard/DailyPlanPanel.module.css`**

11. Remove the `.badge` style block if the element is fully removed from JSX.

### Quality Gates

- Panel label reads "Today's plan"
- No badge visible anywhere in the panel
- "Tomorrow starts clean" copy is gone
- "Shared source of truth" copy is gone
- "Current focus" and "Recent activity" boxes are gone
- A new user (no logs, no AI plan) sees a baseline plan with age-appropriate sleep targets
- The plan note is personalised with the baby's name
- A returning user with an existing AI plan still sees their plan, not the baseline
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Completed Work

- `src/app/dashboard/page.tsx`: Imported `getBaselinePlan`, calculated baby age in weeks from `baby.date_of_birth`, used a static baseline plan when no saved daily plan exists, and removed the `Current focus` / `Recent activity` dashboard cards.
- `src/app/dashboard/page.module.css`: Removed the unused grid, panel, and link styles that belonged to the deleted dashboard cards.
- `src/components/dashboard/DailyPlanPanel.tsx`: Renamed the kicker to `Today's plan`, removed the badge, updated the true empty-state copy and steps, and made baseline plans render through the same active-plan layout while still allowing live plan payloads to replace them cleanly.
- `src/components/dashboard/DailyPlanPanel.module.css`: Removed the obsolete `.badge` styles after deleting the badge element from the panel.
- `src/lib/baseline-plans/index.ts`: Added the static age-band selector and personalised baseline-plan builder used by the dashboard fallback flow.
- `src/lib/baseline-plans/templates/0-8wk.json`: Added the 0-8 week baseline plan template with demand-led sleep guidance and newborn feed anchors.
- `src/lib/baseline-plans/templates/8-16wk.json`: Added the 8-16 week baseline plan template with a four-nap baseline and 60-90 minute wake windows.
- `src/lib/baseline-plans/templates/16-28wk.json`: Added the 16-28 week baseline plan template with a 3-4 nap baseline and 90-120 minute wake windows.
- `src/lib/baseline-plans/templates/28-40wk.json`: Added the 28-40 week baseline plan template with a three-nap baseline and roughly two-hour wake windows.
- `src/lib/baseline-plans/templates/40-52wk.json`: Added the 40-52 week baseline plan template with a two-nap baseline and roughly 2.5-hour wake windows.
- `src/lib/baseline-plans/templates/52-78wk.json`: Added the 52-78 week baseline plan template for the 2-nap to 1-nap transition stage.
- `src/lib/baseline-plans/templates/78wk-plus.json`: Added the 78+ week baseline plan template with a one-nap baseline and 4-5 hour wake windows.
- `src/lib/baseline-plans/index.test.ts`: Added focused tests for baseline-plan age-band selection and baby-name note personalisation.
- `docs/somni_implementation_plan_v6.md`: Added this Section 4 completion summary and recorded the exact files changed.

---

## Section 5 — Polish: Scrollbars, Arrow Alignment, and Chat Caret

**SIS references:** SIS8, SIS9
**Screenshots:** `archive/SIS8.png`, `archive/SIS9.png`

### Sub-issue 5A — Sleep Log Card Arrow Alignment (SIS8)

The `>` arrow in sleep log history items is not vertically centred and sits too close to the edge.

**Relevant file:** Locate the sleep history component under `src/components/sleep/`.
First inspect the file list to find the exact filename and selector.

**Steps:**
1. Find the history item row container. Confirm it uses `display: flex`.
2. Ensure the container has `align-items: center`.
3. Ensure the arrow element has `padding-right: 12px` minimum from the right edge.

### Sub-issue 5B — Sleep Log List Scrollbar (SIS8)

Visible browser scrollbar (and a dash artifact) inside the sleep log list container.

**Steps:**
4. Find the history list container selector. Add:
   ```css
   scrollbar-width: none;   /* Firefox */
   overflow-y: auto;        /* keep scrolling functional */
   ```
5. Add the WebKit rule:
   ```css
   .<historyListSelector>::-webkit-scrollbar {
     display: none;
   }
   ```

### Sub-issue 5C — Chat Textarea Scrollbar (SIS9)

Textarea shows a visible browser-native scrollbar even with short text.

**`src/components/chat/ChatCoach.module.css`**

6. Update `.textarea`:
   ```css
   .textarea {
     width: 100%;
     min-height: 2.5rem;
     max-height: 12rem;
     border-radius: var(--radius-md);
     border: none;
     padding: 0.65rem 0.75rem;
     background: transparent;
     color: var(--color-text);
     resize: none;
     overflow-y: auto;
     scrollbar-width: none;
     field-sizing: content;
     caret-color: var(--color-accent);
   }
   .textarea::-webkit-scrollbar {
     display: none;
   }
   .textarea:focus-visible {
     outline: none;
   }
   ```
   Remove any existing `resize: vertical` rule.

### Sub-issue 5D — Chat Textarea Caret (SIS9)

Blinking cursor "creeps over" the text box boundary due to the resize handle.

`resize: none` and `caret-color` in step 6 above address this.

**`src/components/chat/ChatCoach.tsx`**

7. Remove the `rows={3}` attribute from `<textarea>`. `min-height` in CSS handles minimum size.

### Quality Gates

- Arrow in sleep log history items is vertically centred and ≥8px from right edge
- Sleep log list has no visible scrollbar (but still scrolls when the list is long)
- Chat textarea has no visible scrollbar
- Chat textarea has no resize handle
- Chat caret colour is `var(--color-accent)` (#e8b44a)
- Textarea auto-grows with content (caps at 12rem and scrolls without visible bar)
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Completed Work

- `src/components/sleep/SleepTracker.tsx`: Added a `historyRow` wrapper and `historyArrow` element for each sleep history item so the arrow can be aligned and spaced consistently.
- `src/components/sleep/SleepTracker.module.css`: Added scrollbar-hiding rules to `historyList`, made the history row container explicitly `display: flex` with `align-items: center`, and set `historyArrow` to `padding-right: 12px`.
- `src/components/chat/ChatCoach.module.css`: Updated `.textarea` to the Section 5 spec (`min-height: 2.5rem`, `max-height: 12rem`, `resize: none`, hidden scrollbars, `field-sizing: content`, `caret-color: var(--color-accent)`).
- `src/components/chat/ChatCoach.tsx`: Removed `rows={3}` from the chat textarea so sizing is controlled by CSS.
- `docs/somni_implementation_plan_v6.md`: Added this Section 5 completion summary and listed all changed files.

---

## Section 6 — Send Button Micro-animation + Sleep Page H1 Rename

Two small polish items that can be done in a single session.

### Sub-issue 6A — Send Button Micro-animation During Loading

**Current state:** When `isSending` is true, the send button shows the text `'...'` with no visual
change in appearance.

**Desired state:** The send button pulses (opacity or scale animation) while loading. The `'>'`
icon is replaced with an animated SVG spinner or a pulsing dot.

**Relevant files:**
- `src/components/chat/ChatCoach.module.css`
- `src/components/chat/ChatCoach.tsx`

**Steps:**

1. In `ChatCoach.module.css`, add a spinner keyframe and a `.sendSpin` class:
   ```css
   @keyframes send-spin {
     to { transform: rotate(360deg); }
   }
   .sendButtonLoading {
     opacity: 0.7;
     pointer-events: none;
   }
   .sendButtonLoading::after {
     content: '';
     display: block;
     width: 14px;
     height: 14px;
     border: 2px solid rgba(10,12,26,0.3);
     border-top-color: #0a0c1a;
     border-radius: 50%;
     animation: send-spin 0.7s linear infinite;
   }
   ```
2. In `ChatCoach.tsx`, on the send `<button>`:
   - When `isSending` is true: apply `styles.sendButtonLoading`, render `null` as children
     (the `::after` pseudo-element provides the spinner).
   - When not sending: render `>` as before.

### Sub-issue 6B — Sleep Page H1 Rename

**Current state:** The `/sleep` page H1 mirrors the old chat page heading style:
"Sleep coaching for {babyName}".

**Desired state:** Rename to "{babyName}'s sleep log" to better describe what the page does.

**Relevant file:** `src/app/sleep/page.tsx`

**Steps:**

3. Find the `<h1>` element on the sleep page.
4. Change the content from `Sleep coaching for {babyName}` (or similar) to
   `{babyName}'s sleep log`.

### Quality Gates

- Send button shows a spinning animation (not `'...'` text) while `isSending` is true
- Send button returns to `>` with no animation after the response is received
- Sleep page H1 reads "{babyName}'s sleep log"
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Completed Work

- `src/components/chat/ChatCoach.module.css`: Added `@keyframes send-spin` and a `.sendButtonLoading` state that dims and disables the send button while rendering an animated spinner via `::after`.
- `src/components/chat/ChatCoach.tsx`: Updated the send button to apply `styles.sendButtonLoading` and render no text while `isSending`; restored `>` when not sending.
- `src/app/sleep/page.tsx`: Renamed the sleep page H1 to `{babyName}'s sleep log`.
- `docs/somni_implementation_plan_v6.md`: Added this Section 6 completion summary and listed every changed file.

---

## Section 7 — Plan-Save Inline Feedback on Dashboard

**Current state:** When a plan is saved from chat, the "Dashboard updated" notice only appears
inside the chat thread. A user looking at the dashboard tab never sees confirmation.

**Desired state:** The `DailyPlanPanel` displays a visible "Last updated" timestamp whenever the
plan data is written, so the parent knows the save happened without switching tabs.

### Relevant Files

- `src/components/dashboard/DailyPlanPanel.tsx`
- `src/components/dashboard/DailyPlanPanel.module.css`

### Detailed Steps

1. The `DailyPlanRecord` type already has an `updatedAt` field. In `DailyPlanPanel.tsx`,
   read `plan.updatedAt` when the plan is in the active state.
2. Below the plan title (and above the target lists), render a small timestamp line when
   `plan.updatedAt` is not null:
   ```tsx
   {plan.updatedAt ? (
     <p className={styles.lastUpdated}>
       Updated {formatRelativeTime(plan.updatedAt)}
     </p>
   ) : null}
   ```
3. Implement a `formatRelativeTime(updatedAt: string): string` helper inside the component file
   (or in a shared util) that returns human-readable relative time:
   - within 2 min → "just now"
   - within 60 min → "X minutes ago"
   - same day → "today at HH:MM"
   - otherwise → the full locale date string
4. In `DailyPlanPanel.module.css`, add:
   ```css
   .lastUpdated {
     margin: 0;
     font-size: 0.8rem;
     color: var(--color-text-faint);
     letter-spacing: 0.02em;
   }
   ```
5. For the real-time update case (plan updated while the user is on the dashboard tab via the
   localStorage event): the `setPlan` call already triggers a re-render, so the timestamp will
   update automatically.

### Quality Gates

- An active plan shows a "Updated X minutes ago" or "Updated just now" line below the title
- The timestamp re-renders correctly when a new plan update arrives via localStorage event
- A new user on the baseline plan with no `updatedAt` does not show the timestamp line
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Completed Work

- `src/components/dashboard/DailyPlanPanel.tsx`: Added a `formatRelativeTime(updatedAt)` helper with the Section 7 behavior (`just now`, `X minutes ago`, `today at HH:MM`, otherwise locale date), and rendered `Updated {formatRelativeTime(plan.updatedAt)}` in the active-plan view below the title and above target lists when `plan.updatedAt` exists.
- `src/components/dashboard/DailyPlanPanel.module.css`: Added the required `.lastUpdated` style for the inline timestamp.
- `docs/somni_implementation_plan_v6.md`: Added this Section 7 completion summary and listed all files changed for this section.

---

## Section 8 — Bottom Nav Active Tab Indicator Upgrade

**Current state:** The bottom navigation bar's active tab uses only a slightly lighter/different
background. The contrast between active and inactive tabs is low, making it hard to tell at a
glance which section the user is in.

**Desired state:** The active tab has a clear brand-colour accent — either an underline in
`var(--color-accent)` at the top of the tab, or the icon and label rendered in the accent colour.

### Relevant Files

First, locate the bottom nav component. Inspect `src/components/` and `src/app/layout.tsx` to
find where the bottom nav is rendered (likely `src/components/pwa/` or `src/components/ui/`).

### Detailed Steps

1. Find the nav component and its CSS module.
2. Identify the active-state class or the conditional logic that applies the active style.
3. Update the active tab styles:
   ```css
   /* Option 1: top accent bar (recommended) */
   .navItemActive {
     color: var(--color-accent);
     position: relative;
   }
   .navItemActive::before {
     content: '';
     position: absolute;
     top: 0;
     left: 20%;
     right: 20%;
     height: 2px;
     border-radius: 2px;
     background: var(--color-accent);
   }

   /* Inactive stays the existing muted style */
   ```
4. Ensure the icon SVG or icon font colour inherits from the parent `color` rule so it switches
   to accent on active without extra selectors.
5. Add a subtle transition so swapping tabs doesn't feel abrupt:
   ```css
   .navItem {
     transition: color 0.15s ease;
   }
   ```

### Quality Gates

- Active nav tab is clearly distinguishable from inactive tabs (accent colour applied)
- The top-edge accent bar (or equivalent) is visible on the active tab
- Switching tabs transitions smoothly without a jarring flash
- All three tabs (Dashboard, Sleep, Chat) correctly reflect active state on their respective pages
- `npm run lint` passes
- `npm test -- --run` passes
- `npm run build` passes

### Completed Work

- `src/components/ui/AppBottomNav.module.css`: Updated bottom-nav active state to use `var(--color-accent)`, added a top-edge accent bar via `.active::before`, added a subtle `color` transition on `.link`, and ensured icon SVG color inherits parent color so active tab icon/label switch together.
- `docs/somni_implementation_plan_v6.md`: Added this Section 8 completion summary and listed all files changed for this section.

---

## Execution Order Summary

| Section | SIS Ref | Dependencies | Complexity | Model | Reasoning |
|---------|---------|-------------|------------|-------|-----------|
| 1 — Chat header merge | SIS5 | None | Low | 5.3 Codex | medium |
| 2 — WhatsApp bubbles | SIS5/5A | Section 1 | Medium | 5.4 | medium |
| 3 — Dashboard declutter | SIS6 | None | Low | 5.3 Codex | medium |
| 4 — Plan panel + baseline | SIS7 | None | High | 5.4 | high |
| 5 — Scrollbar/caret/arrow | SIS8/9 | None | Low | 5.3 Codex | low |
| 6 — Send animation + H1 | Observation | Section 2 | Low | 5.3 Codex | low |
| 7 — Plan-save feedback | Observation | Section 4 | Low | 5.3 Codex | low |
| 8 — Nav active state | Observation | None | Low | 5.3 Codex | low |

**Recommended batch order:**
- Batch A (any order): Sections 1, 3, 5, 8
- Batch B: Section 2 (after 1), Section 4 (standalone)
- Batch C: Section 6 (after 2), Section 7 (after 4)

---

## Model Selection Rationale

**`5.4` + `high`** → Section 4 only. Requires product judgment on baby age band content,
data model decisions, and on-brand copy authoring for the baseline template notes.

**`5.4` + `medium`** → Section 2. CSS layout work with accessibility considerations (sr-only,
sticky form, iOS safe area) needs stronger spatial reasoning.

**`5.3 Codex` + `medium`** → Sections 1, 3. Bounded JSX restructuring and copy edits.

**`5.3 Codex` + `low`** → Sections 5, 6, 7, 8. Pure CSS, small helpers, or clearly scoped
single-component changes.

**Skip `extra high`** — no section is ambiguous enough to justify it. All scopes are clearly
defined with file-level targets.
