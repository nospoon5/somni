# Push Notifications Implementation Tasks

**Completed:** 17 July 2026 in commit `e81f3f4`. Production migration applied and the two-caregiver push, quiet-hours, feed, and unread-state flow verified.

## Stage 1: Database Migrations

- [x] Create `supabase/migrations/20260716100000_push_notifications.sql`.
- [x] Add the owner-scoped `push_subscriptions` table and RLS policies.
- [x] Add notification preference columns to `profiles`.
- [x] Add the owner-readable `notification_logs` table and RLS policies.

## Stage 2: VAPID Keys and Service Worker

- [x] Create `scripts/generate-vapid-keys.js`.
- [x] Generate keys and store them in the ignored `.env.local` file.
- [x] Add push and notification-click handlers to `public/sw.js`.
- [x] Register the service worker in the application.

## Stage 3: Subscription Endpoint and Sender

- [x] Add the authenticated subscribe/unsubscribe API route.
- [x] Add the notification sender with feed logging and suppression checks.
- [x] Add focused tests for ownership, suppression windows, and expired subscriptions.

## Stage 4: Sleep Log Trigger Integration

- [x] Notify other accepted caregivers when a sleep session starts.
- [x] Notify other accepted caregivers when a sleep session completes.

## Stage 5: Notification Center and Settings

- [x] Add profile notification settings.
- [x] Add the dashboard bell, unread count, feed, and mark-all-read action.
- [x] Verify the complete caregiver flow using `docs/TEST_ACCOUNTS.md`.

## Quality Gates

- [x] `npx tsc --noEmit` completes with no errors.
- [x] VAPID key generation produces a valid key pair.
- [x] Browser push and in-app feed behavior pass the two-caregiver scenario.
