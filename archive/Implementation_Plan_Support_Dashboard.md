# Implementation Plan: Admin Support Dashboard
*This is a modular implementation plan to build a secure, internal support ticket viewer for triage and support resolution.*

---

## 1. Overview & Objectives

Currently, Somni logs user feedback and errors through a public support form directly into the `support_tickets` database table. However, there is no UI to read or manage these tickets. We need:

1.  **Admin Privileges:** An `is_admin` boolean flag on user profiles.
2.  **Secure Route:** A `/admin/support` route restricted to admin accounts.
3.  **Ticket Triage UI:** A simple dashboard to view user submissions, filter by status (`open`, `in_progress`, `resolved`), and toggle statuses.

---

## 2. Stage 1: Database Admin Flag & Policies
**Goal:** Add administrative role attributes to user profiles and secure the support queries.

### Tasks
- [x] **Task 1.1: Add `is_admin` Column**
  - **Migration:** Added `supabase/migrations/202607141500_add_admin_flag.sql`.
  - **Action:** Add `is_admin` boolean column to the `profiles` table, defaulting to `false`. Seed your specific developer profile ID to `true`.
- [x] **Task 1.2: Support Tickets RLS updates**
  - **Action:** Update RLS on the `support_tickets` table so that normal users can only `INSERT` (submit tickets), but profiles with `is_admin = true` can `SELECT` and `UPDATE` all tickets.
  - **Security:** Authenticated users retain updates to ordinary profile fields but cannot change `is_admin` themselves.

### Model Recommendations
*   **Antigravity:** `Claude Sonnet 4.6`
*   **Codex:** `5.4` (Reasoning: `Medium`)

---

## 3. Stage 2: Admin Authentication & Routing
**Goal:** Secure the `/admin` path at the routing/server component level.

### Tasks
- [x] **Task 2.1: Admin Verification Guard**
  - **Files:** `src/lib/admin/guard.ts` and `src/app/admin/layout.tsx`.
  - **Action:** Verify the authenticated user session has `is_admin = true` in their profile. If not, redirect immediately to `/dashboard`.
  - **Security:** Every admin Server Action and Route Handler must also call `requireAdmin()` because a layout is not sufficient authorization for a direct mutation request.

### Model Recommendations
*   **Antigravity:** `Claude Sonnet 4.6` or `Gemini 3.1 Pro (High)`
*   **Codex:** `5.3` (Reasoning: `Medium` or `High`)

---

## 4. Stage 3: Support Triage Panel UI
**Goal:** Build the ticket display list and status transition controls.

### Tasks
- [x] **Task 3.1: Admin Dashboard View**
  - **File:** `src/app/admin/support/page.tsx`
  - **Action:** Render a tabular list of support tickets sorted by `created_at` descending. Include user email, issue description, origin page, and status.
- [x] **Task 3.2: Status Update Action**
  - **File:** `src/app/admin/support/actions.ts`
  - **Action:** Implement `updateTicketStatusAction(ticketId, newStatus)`. Create button tags in the UI to instantly toggle status.

### Model Recommendations
*   **Antigravity:** `Gemini 3.5 Flash (Medium)` or `Claude Sonnet 4.6`
*   **Codex:** `5.3` (Reasoning: `Medium`)

---

## 5. Stage Gates & Quality Control

1.  **Unauthorized Block Check:** Access `/admin/support` with a regular test account (e.g. `gentletester@test.com`). Verify redirect back to `/dashboard` triggers immediately.
2.  **Admin Read Check:** Access `/admin/support` with the seeded admin account. Verify list displays correctly.
3.  **Triage Action Verification:** Click "Resolve" on a test ticket. Refresh the page to confirm status remains "resolved" and updates in Supabase.
