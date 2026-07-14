# Implementation Plan Alpha (Pathway 1: UX/Copy Polish & Beta Launch)
*This is a living document. Antigravity and Codex agents must update progress markers as they complete tasks. This plan is the first source of truth for any agent spun up on the project.*

---

## 1. Overview & Objectives

The goal of this phase is to elevate the **onboarding experience, copywriting, and mobile layout** of Somni to feel premium, warm, and highly personalized. This polish is critical for making Somni feel distinct and superior to generic chatbots like ChatGPT.

---

## 2. Stage 1: Onboarding Copywriting & Subtitles
**Goal:** Soften copy, add helpful context, and simplify technical dropdown descriptions.

### Tasks
- [ ] **Task 1.1: Update Main Heading & Subtitle**
  - **File:** [onboarding/page.tsx](file:///c:/AI%20Projects/01_Apps/Somni/src/app/onboarding/page.tsx)
  - **Heading:** *"A few simple details to help Somni tailor your baby's plan."*
  - **Subtitle:** *"We ask these questions to tailor Somni to your baby's details and your parenting style."*
- [ ] **Task 1.2: Update Step 2 (Style questionnaire) Intro**
  - **File:** [OnboardingForm.tsx](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.tsx)
  - **Intro Text:** *"Somni will adapt to you as it gets to know you better. This is just a starting point to determine which coaching style suits your family best: gentle, balanced, or fast track. There is no right or wrong answer here."*
- [ ] **Task 1.3: Add Subtitle Context**
  - **File:** [OnboardingForm.tsx](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.tsx)
  - **Action:** Add a helpful subtitle below the *"How would you like the plan to feel?"* selector to explain that it sets the target pacing of sleep adjustments.
- [ ] **Task 1.4: Simplify Select Options**
  - **File:** [onboarding-preferences.ts](file:///c:/AI%20Projects/01_Apps/Somni/src/lib/onboarding-preferences.ts)
  - **Action:** Simplify night feeds option label (change *"Yes, night feeds are still part of things"* -> *"Yes, still feeding at night"*).
  - **Action:** Simplify day structure option label (change *"Mostly at home, so the day can stay flexible"* -> *"Mostly at home, flexible"*).

### Model Recommendations
*   **Antigravity:** `Gemini 3.5 Flash (Low/Medium)` (Simple text changes, low reasoning needed)
*   **Codex:** `5.4 Mini` (Reasoning: `Light`)

---

## 3. Stage 2: Form Field Styling & Premium Layout
**Goal:** Fix visual bugs (calendar icon contrast, dropdown overflows) and refactor grid to a modern, centered single-column layout.

### Tasks
- [ ] **Task 2.1: Fix Date Input Calendar Contrast**
  - **File:** [OnboardingForm.module.css](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.module.css)
  - **Action:** Add `color-scheme: dark;` to the date input (`.field input[type="date"]`) so the calendar icon is visible (white instead of black) on dark backgrounds.
- [ ] **Task 2.2: Standardize Field Widths & Prevent Overhangs**
  - **File:** [OnboardingForm.module.css](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.module.css)
  - **Action:** Ensure all `.field input` and `.field select` have `width: 100%`, `max-width: 100%`, and `box-sizing: border-box` to prevent the "nap pattern" dropdown from overflowing its container.
- [ ] **Task 2.3: Convert Grid to Premium Single-Column Layout**
  - **File:** [OnboardingForm.module.css](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.module.css)
  - **Action:** Refactor the 2-column `.fieldGrid` layout into a centered, single-column container with a maximum width (`max-width: 500px; margin: 0 auto;`) for a cleaner, more focused feel.

### Model Recommendations
*   **Antigravity:** `Gemini 3.5 Flash (Medium)` or `Claude Sonnet 4.6` (Visual styling, CSS adjustments)
*   **Codex:** `5.3` (Reasoning: `Medium`)

---

## 4. Stage 3: Style Slider Labels & Anchors
**Goal:** Make the 1-10 slider scales intuitive by providing descriptive text anchors at both ends of the scale.

### Tasks
- [ ] **Task 3.1: Define Slider Anchor Objects**
  - **File:** [OnboardingForm.tsx](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.tsx)
  - **Action:** Map the 5 questions to descriptive anchors instead of simple numeric prompts:
    1. **Approach to progress:** Left: *"Very gentle, even if progress takes longer"* | Right: *"Fastest progress, comfortable with a stricter approach"*
    2. **Routine preference:** Left: *"Prefer flexible days and following cues"* | Right: *"Prefer a steady, predictable daily routine"*
    3. **Responsiveness vs. Structure:** Left: *"Prioritize high responsiveness/soothing"* | Right: *"Prioritize structure/independent sleep"*
    4. **Pacing of changes:** Left: *"Small, gradual changes over time"* | Right: *"A quick, comprehensive reset"*
    5. **Comfort with faster methods:** Left: *"Cautious, prefer to avoid fast methods"* | Right: *"Ready to try faster methods if safe"*
- [ ] **Task 3.2: Update Slider Layout**
  - **File:** [OnboardingForm.tsx](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.tsx) and [OnboardingForm.module.css](file:///c:/AI%20Projects/01_Apps/Somni/src/components/onboarding/OnboardingForm.module.css)
  - **Action:** Render these labels on either side of the slider row. Ensure text wraps cleanly and doesn't overlap on mobile viewports.

### Model Recommendations
*   **Antigravity:** `Gemini 3.5 Flash (High)` or `Claude Sonnet 4.6`
*   **Codex:** `5.3` (Reasoning: `High`)

---

## 5. Stage 4: Dashboard Copy & Spacing Checks
**Goal:** Soften dashboard copy and guarantee smooth responsiveness on 375px wide screens.

### Tasks
- [ ] **Task 4.1: Soften Daily Plan Summary Copy**
  - **File:** [DailyPlanPanel.tsx](file:///c:/AI%20Projects/01_Apps/Somni/src/components/dashboard/DailyPlanPanel.tsx)
  - **Action:** Replace technical phrases (e.g. *"This is the shared plan Somni is keeping in sync today"*) with warmer, parent-centric copy.
- [ ] **Task 4.2: Spacing & Layout Check (375px Viewport)**
  - **Action:** Audit `/dashboard`, `/chat`, `/sleep`, and `/support` on a 375px simulated mobile viewport. Adjust padding, margin, and font sizes where needed to eliminate awkward overflows.

### Model Recommendations
*   **Antigravity:** `Gemini 3.5 Flash (Medium)` (Good for styling and copy edits)
*   **Codex:** `5.4` (Reasoning: `Medium`)

---

## 6. Stage 5: Stripe Billing Checkout Validation
**Goal:** Hook up and test real payment redirection and webhook processing.

### Tasks
- [ ] **Task 5.1: Review Stripe Env Configuration**
  - **Action:** Verify public and secret Stripe keys are correctly mapped.
- [ ] **Task 5.2: Test Stripe Checkout Redirect & Portal**
  - **Action:** Verify checking out transitions cleanly to Stripe and back to the app `/dashboard`.
- [ ] **Task 5.3: Webhook Verification**
  - **Action:** Verify local Stripe webhook listener updates the `subscriptions` table correctly when a mockup checkout is completed.

### Model Recommendations
*   **Antigravity:** `Gemini 3.1 Pro (High)` or `Claude Sonnet 4.6` (Requires checking backend network integrations)
*   **Codex:** `5.6 Sol` (Reasoning: `High` or `Extra High`)

---

## 7. Stage Gates & Quality Control

To pass this implementation plan:

1.  **Code Check:** `npm run lint` and `npm test -- --run` must return 100% green.
2.  **Smoke Check:** `node scripts/verify-onboarding-smoke.mjs` must run successfully on a temporary account.
3.  **Mobile Polish:** Visual inspection at 375px shows zero layout bugs or text cutoffs.
