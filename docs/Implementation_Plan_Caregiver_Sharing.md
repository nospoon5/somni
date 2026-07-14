# Implementation Plan: Caregiver Sharing & Co-Parenting
*This is a modular implementation plan for enabling multiple caregivers (e.g., Mum, Dad, Nanny) to sync logs and plans in real-time.*

---

## 1. Overview & Objectives

Currently, Somni's database model restricts access to a baby record solely to the user who created it (`profile_id`). To allow co-parents to share data, we need a secure sharing model:

1.  **Join Table (`baby_shares`):** Maps guest profiles to babies with specific permissions (`admin`, `editor`).
2.  **Shared RLS Rules:** Update Supabase Row-Level Security policies on `sleep_logs`, `daily_plans`, and `sleep_plan_profiles` to allow access to users in the join table.
3.  **Invite Flow UI:** Allow the primary account holder to invite another caregiver by email.

---

## 2. Stage 1: Database Schema & RLS Policies
**Goal:** Create the relational join schema and update RLS policies to permit shared read/write access.

### Tasks
- [x] **Task 1.1: Create `baby_shares` Table**
  - **Migration:** Add `supabase/migrations/20260714_add_baby_shares.sql`.
  - **Columns:** `id`, `baby_id` (foreign key), `profile_id` (foreign key, nullable until accepted), `email` (for invitations), `access_role` (`admin`, `caregiver`), `status` (`pending`, `accepted`), `created_at`.
  - **Constraints:** Unique index on `(baby_id, email)`.
- [x] **Task 1.2: Update Supabase RLS Policies**
  - Update policies on `babies`, `sleep_logs`, `daily_plans`, `sleep_plan_profiles`, and `sleep_plan_change_events` to check if `auth.uid()` matches either the owner's `profile_id` OR has an `accepted` status row in `baby_shares`.

### Model Recommendations
*   **Antigravity:** `Claude Sonnet 4.6` or `Claude Opus 4.6` (Opus is excellent for safety-critical Postgres RLS policies)
*   **Codex:** `5.6 Sol` (Reasoning: `High` or `Extra High`)

---

## 3. Stage 2: Invite System Logic & Server Actions
**Goal:** Build invite creation, acceptance, and authorization helper logic.

### Tasks
- [x] **Task 2.1: Invite Generation Helper**
  - **File:** `src/app/profile/actions.ts`
  - **Action:** Create `inviteCaregiverAction(babyId, email)`. Write a pending row to `baby_shares`.
- [x] **Task 2.2: Acceptance Verification Route**
  - **File:** `src/app/invite/accept/page.tsx`
  - **Action:** Read the invite code/ID, verify the logged-in user matches the target email, and update status to `accepted` in `baby_shares`.
- [x] **Task 2.3: Modify Authorization Queries**
  - Audit database fetch helpers in `src/lib/daily-plan-derivation.ts` and `src/lib/sleep-plan-profile.ts` to query through shared rights.

### Model Recommendations
*   **Antigravity:** `Claude Sonnet 4.6`
*   **Codex:** `5.5` (Reasoning: `Medium` or `High`)

---

## 4. Stage 3: Onboarding & Profile Invite UI
**Goal:** Create the parent-facing invite screens.

### Tasks
- [x] **Task 3.1: Profile Caregiver List**
  - **File:** `src/components/profile/CaregiverSettings.tsx`
  - **Action:** Display currently linked caregivers, their statuses (`pending`/`accepted`), and a form to invite a new caregiver.
- [ ] **Task 3.2: Verification & Real-time Check**
  - Ensure that changes saved by Caregiver A (e.g., logging a nap) instantly reflect on Caregiver B's dashboard.

### Model Recommendations
*   **Antigravity:** `Gemini 3.5 Flash (Medium)` or `Claude Sonnet 4.6`
*   **Codex:** `5.3` (Reasoning: `Medium`)

---

## 5. Stage Gates & Quality Control

1.  **RLS Isolation Test:** Verify User C (unrelated) cannot access, invite, or view logs for User A's baby.
2.  **Invite Acceptance Flow:** User B accepts invite -> accesses `/dashboard` for User A's baby -> creates a sleep log -> log appears in Supabase tagged with User A's baby.
3.  **Lint & Test:** `npm run lint` and `npm test -- --run` remain green.
