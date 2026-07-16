# Implementation Plan: PWA Web Push & Live Caregiver Alerts
*This plan outlines the design and implementation steps for self-hosted Web Push notifications, nighttime suppression windows, and an in-app notification feed.*

---

## 1. Git & Parallel Execution Guardrails
To prevent merge conflicts and database schema collisions while other subagents work on schedule adaptation concurrently:

1. **Working Branch:** The agent executing this plan must create and work in a separate branch:
   ```bash
   git checkout -b feature/push-notifications
   ```
2. **Database Migration File:** Use exactly this filename for database migrations:
   `supabase/migrations/20260716100000_push_notifications.sql`
3. **File Boundaries:** Do not edit core scheduling logic (`src/lib/sleep-plan-log-adaptation.ts`), chat page files (`src/app/api/chat`), or daily plan components. Keep changes restricted to notification APIs, Service Workers, settings pages, and header notification items.

---

## 2. Stage 1: Database Migrations
**Goal:** Track subscriber browser keys, parent notification preferences, and in-app feed history logs.

### Tasks
- [ ] **Task 1.1: Create Migration File**
  - Create file `supabase/migrations/20260716100000_push_notifications.sql`.
  - **`push_subscriptions` table:** Columns `id`, `profile_id` (FK), `endpoint` (Text, Unique), `p256dh` (Text), `auth` (Text), `user_agent` (Text), `created_at`. Add RLS policies permitting insert/delete by the authenticated owner profile.
  - **`profiles` table changes:** Add columns:
    * `push_enabled` (boolean, default false)
    * `in_app_feed_enabled` (boolean, default true)
    * `night_suppression_enabled` (boolean, default true)
    * `suppression_start` (Text, e.g., '19:00')
    * `suppression_end` (Text, e.g., '06:00')
  - **`notification_logs` table:** Columns `id`, `profile_id` (FK), `title` (Text), `body` (Text), `is_read` (boolean, default false), `created_at`. Permitted SELECT/UPDATE by authenticated owner.

### Model Recommendations
* **Antigravity:** `Claude Sonnet 4.6` (Ensures RLS security policies on user browser endpoints)
* **Codex:** `5.6 Sol` (Reasoning Effort: `High`)

---

## 3. Stage 2: VAPID Generation & Service Worker Setup
**Goal:** Setup security handshakes and service worker registration to capture incoming background messages.

### Tasks
- [ ] **Task 2.1: Key Generation Script**
  - Create `scripts/generate-vapid-keys.js` using the NPM `web-push` package.
  - Output public and private VAPID keys to the console, and guide the user on adding them to `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
- [ ] **Task 2.2: Service Worker Handler**
  - In `public/sw.js` (or your PWA service worker file), add a listener for the `push` event:
    ```javascript
    self.addEventListener('push', function(event) {
      const data = event.data ? event.data.json() : { title: 'Somni Update', body: 'New alert.' };
      event.waitUntil(
        self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/icon.png',
          badge: '/badge.png'
        })
      );
    });
    ```

### Model Recommendations
* **Antigravity:** `Gemini 3.5 Flash (High)` (Excellent for standalone script and worker handlers)
* **Codex:** `5.5` (Reasoning Effort: `Medium`)

---

## 4. Stage 3: Subscription Endpoint & Sender Module
**Goal:** Expose endpoints for browser subscription and write the trigger logic with nighttime checks.

### Tasks
- [ ] **Task 3.1: Subscribe API Endpoint**
  - Create Next.js route `src/app/api/notifications/subscribe/route.ts`. Expose POST to save/update and DELETE to unsubscribe.
- [ ] **Task 3.2: Write Notification Sender Utility**
  - Create file `src/lib/notifications/sender.ts`.
  - Expose `sendNotificationToUser(profileId, title, body)`.
  - Fetch target user's `profiles` preference values.
  - Write a row to the `notification_logs` table for the in-app feed.
  - **Suppression Check:** Determine target user's local hour (from their profile timezone). If `night_suppression_enabled` is true and current hour falls in their suppression window, skip the push payload.
  - If not suppressed and `push_enabled` is true, trigger the `web-push` send event using the VAPID keys.

### Model Recommendations
* **Antigravity:** `Claude Sonnet 4.6` or `Gemini 3.1 Pro (High)` (Required for complex timezone comparison logic)
* **Codex:** `5.6 Terra` (Reasoning Effort: `High`)

---

## 5. Stage 4: Trigger Integration
**Goal:** Fire notifications automatically on sleep events.

### Tasks
- [ ] **Task 4.1: Sleep Log Hooks**
  - Modify `src/app/sleep/actions.ts` when logs are added or completed.
  - Retrieve the baby's caregivers list (excluding the current user) via `baby_shares`.
  - For each caregiver, call `sendNotificationToUser(caregiverId, "Sleep Session Update", "[User] started/completed Aria's sleep session.")`.

### Model Recommendations
* **Antigravity:** `Gemini 3.5 Flash (Medium)` (Straightforward integration hook)
* **Codex:** `5.4` (Reasoning Effort: `Medium`)

---

## 6. Stage 5: In-App Notification Center UI & Settings
**Goal:** Provide notification settings toggles and an in-app feed display.

### Tasks
- [ ] **Task 5.1: Profile Settings Form**
  - In `src/app/profile/page.tsx`, add toggles for push alerts, feed, night suppression, and time inputs for start/end suppression windows.
- [ ] **Task 5.2: Notification Bell Overlay**
  - In the dashboard header layout, add a "Bell" icon showing count of unread entries from `notification_logs`.
  - Clicking the icon opens a popover listing recent notifications (e.g. *"Dad logged a nap"*) with a button to "Mark all as read".

### Model Recommendations
* **Antigravity:** `Gemini 3.5 Flash (Medium)` (Best for standard UI and CSS layouts)
* **Codex:** `5.4 Mini` (Reasoning Effort: `Medium`)

---

## 7. Quality Control Gates
To complete this plan:
1. **Compilation Check:** Running `npx tsc --noEmit` returns zero errors.
2. **Local Key Verification:** Running `node scripts/generate-vapid-keys.js` creates valid keys.
3. **Simulated Notification Check:**
   - Log in with Test User A on Browser 1 (request/allow notifications).
   - Log in with Co-Caregiver B on Browser 2.
   - User B logs a sleep session.
   - Verify:
     * A row is added in `notification_logs` for User A.
     * User A receives a push notification on Browser 1.
     * Enable night suppression on User A, repeat the test, and confirm **no** push sounds, but the row appears in User A's header bell feed.
