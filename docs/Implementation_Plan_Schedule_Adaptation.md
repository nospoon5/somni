# Implementation Plan: Log & Chat-Driven Balanced Schedule Adaptation
*This plan outlines the design and implementation steps for dynamically adapting a baby's daily schedule when they wake up earlier or later than their baseline target, complete with an interactive dashboard banner.*

**Status:** Complete and applied to production Supabase on 17 July 2026. Implemented in commit `6a877fd` and verified with the full TypeScript and automated test suites.

---

## 1. Git & Parallel Execution Guardrails
To prevent merge conflicts and database schema collisions while other subagents work on notifications concurrently:

1. **Working Branch:** The agent executing this plan must create and work in a separate branch:
   ```bash
   git checkout -b feature/schedule-adaptation
   ```
2. **Database Migration File:** Use exactly this filename for database migrations:
   `supabase/migrations/20260716090000_schedule_adaptation.sql`
3. **File Boundaries:** Do not edit service worker scripts, API routes under `/api/notifications`, or profile settings components. Keep changes restricted to plan derivation libraries, chat route handlers, and dashboard components.

---

## 2. Stage 1: Database Migration
**Goal:** Track recommendations that are pending approval and record dismissed suggestions so they do not reappear.

### Tasks
- [x] **Task 1.1: Create Database Migration File**
  - Create file `supabase/migrations/20260716090000_schedule_adaptation.sql`.
  - Add a nullable column `pending_rescue_targets` (JSONB) to the `daily_plans` table to store the calculated dampened sleep/feed targets.
  - Add a boolean column `rescue_dismissed` to the `daily_plans` table, defaulting to `false`.
  - Ensure Row-Level Security (RLS) policies allow read/write to these fields by authenticated caregivers (check `baby_shares` and primary owner matching).

### Model Recommendations
* **Antigravity:** `Claude Sonnet 4.6` (Excellent for precise Postgres SQL and RLS integrity)
* **Codex:** `5.6 Sol` (Reasoning Effort: `High`)

---

## 3. Stage 2: Balanced Schedule Damping Logic
**Goal:** Implement the mathematical decay function inside `src/lib/sleep-plan-log-adaptation.ts` to shift subsequent sleep windows dynamically.

### Tasks
- [x] **Task 2.1: Write the Damping Shift Helper**
  - In `src/lib/sleep-plan-log-adaptation.ts`, create a helper `calculateDampenedRescueTargets(profile, actualWakeTime, targetWakeTime)`.
  - Calculate the deviation: $\Delta = \text{actualWakeTime} - \text{targetWakeTime}$ (in minutes).
  - Define the decay coefficients based on `target_nap_count`:
    * **If 2 Naps:** Nap 1 shift = $1.0 \times \Delta$, Nap 2 shift = $0.5 \times \Delta$, Bedtime shift = $0.5 \times \Delta$.
    * **If 3 Naps:** Nap 1 shift = $1.0 \times \Delta$, Nap 2 shift = $0.66 \times \Delta$, Nap 3 shift = $0.33 \times \Delta$, Bedtime shift = $0.33 \times \Delta$.
  - Adjust each target time by its coefficient, rounding to the nearest 5 minutes.
- [x] **Task 2.2: Integrate into Daily Rescue Evaluator**
  - Update `buildDailyRescueEvaluation` in `src/lib/sleep-plan-log-adaptation.ts` to execute this damping calculation if today's morning wake log shows a deviation of $\ge 20$ minutes from the profile's `usual_wake_time`.
  - Instead of automatically overwriting the daily plan, return these targets as `pendingPlan` values.
- [x] **Task 2.3: Unit Testing**
  - Update `src/lib/sleep-plan-log-adaptation.test.ts` to verify the math outputs for early waking (e.g. -45 mins) and late waking (e.g. +30 mins) match the decay ratios.

### Model Recommendations
* **Antigravity:** `Claude Sonnet 4.6` or `Gemini 3.1 Pro (High)` (Crucial for algorithms and unit testing)
* **Codex:** `5.5` (Reasoning Effort: `High`)

---

## 4. Stage 3: Chat Tool-Calling & Parser
**Goal:** Allow parents to type wake times in chat (e.g., *"Aria woke up at 6:00 AM instead of 7:00 AM"*), matching the input to a sleep log entry and triggering the adaptation calculation.

### Tasks
- [x] **Task 3.1: Define the Sleep Logging Chat Tool**
  - In `src/app/api/chat/route.ts` (or the AI system prompt/tools file), define a tool `create_completed_sleep_log(babyId, startTime, endTime, isNight, notes)`.
  - When the model invokes this tool, insert a completed sleep log row in Supabase.
- [x] **Task 3.2: Trigger Evaluation Post-Tool Call**
  - In the chat route response handler, if `create_completed_sleep_log` is called, run `maybeApplyLogDrivenAdaptation` to compute if a daily rescue damping is needed.
  - If a rescue is calculated, write it to `pending_rescue_targets` in the database.
  - Inject a prompt instruction telling the AI to warm-alert the parent about the dashboard banner.

### Model Recommendations
* **Antigravity:** `Gemini 3.1 Pro (High)` (Excellent tool-calling state management)
* **Codex:** `5.6 Terra` (Reasoning Effort: `High`)

---

## 5. Stage 4: Dashboard Banner UI & Server Actions
**Goal:** Show a warm, dismissible banner to the parent on the dashboard.

### Tasks
- [x] **Task 4.1: Implement Plan Actions**
  - Create server actions `acceptDailyRescueAction(babyId, planDate)` and `dismissDailyRescueAction(babyId, planDate)` in `src/app/sleep/actions.ts`.
  - `acceptDailyRescueAction` copies `pending_rescue_targets` into the plan's active `sleep_targets` and clears the pending JSON.
  - `dismissDailyRescueAction` toggles `rescue_dismissed` to `true`.
- [x] **Task 4.2: Build the Dashboard Banner Component**
  - Create a responsive React component in `src/components/dashboard/DailyPlanPanel.tsx`.
  - If `pending_rescue_targets` is present and `rescue_dismissed` is false, show a warm, stylized card:
    * *"Aria woke up early at 6:15 AM today. Would you like to shift today's schedule (Nap 1 to 8:15 AM, Nap 2 to 12:40 PM, Bedtime to 6:40 PM) to avoid overtiredness?"*
    * Provide buttons: **[Update Schedule]** (fires accept action) and **[Dismiss]** (fires dismiss action).

### Model Recommendations
* **Antigravity:** `Gemini 3.5 Flash (Medium)` (Fast, cost-efficient React TSX styling)
* **Codex:** `5.4` (Reasoning Effort: `Medium`)

---

## 6. Quality Control Gates
To complete this plan:
1. [x] **TypeScript Check:** `npx tsc --noEmit` returned no errors.
2. [x] **Unit Tests:** The adaptation tests and the complete suite passed (141/141 tests).
3. [x] **Integration Check:** The completed flow creates the log-driven rescue suggestion and supports accepting or dismissing it from the dashboard.
