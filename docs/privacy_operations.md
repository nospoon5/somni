# Privacy Operations Runbook

This document inventories the personal data stored by Somni, its purpose, retention limits, and paths for user data rights (GDPR/CCPA compliance).

## 1. Data Inventory

| Data Element | Purpose | Retention | Deletion Path |
|--------------|---------|-----------|---------------|
| **Email Address** | Authentication, Support, Invites | Life of account | Deleted when user deletes account. |
| **Profile Name** | UI personalization | Life of account | Deleted when user deletes account. |
| **Baby Name & DOB** | Age-based AI sleep plans | Life of baby profile | Deleted when caregiver deletes baby profile or account. |
| **Sleep Logs** | Tracking sleep patterns, Sleep Score | Life of baby profile | Deleted when baby profile or account deleted. |
| **Daily Plans** | Record of AI recommendations | Life of baby profile | Deleted when baby profile or account deleted. |
| **AI Memory** | Storing long-term coaching context | Life of baby profile | Erased on baby profile deletion. |
| **Chat Transcripts**| AI context and safety auditing | Until account deletion in Alpha 1.2; no automated time-based pruning is currently deployed | Deleted when the account is deleted. |
| **Support Tickets** | Customer service | Until account deletion in Alpha 1.2; no automated time-based pruning is currently deployed | Deleted on account deletion. |
| **Push Subscriptions**| Sending web push notifications | Until token expires or revocation | Deleted on account deletion. |
| **Stripe Customer and Subscription** | Billing and entitlement tracking | Life of account, subject to Stripe/legal financial-record retention | Account deletion deletes the Stripe customer (which immediately cancels active subscriptions) before deleting the Somni account. Stripe may retain transaction records where legally required. |

## 2. User Data Rights

### Right to Access & Portability (Export)
Users can export their data payload in JSON format by visiting **Profile > Data Controls & Privacy > Export My Data**. The export is paginated so it is not truncated at the database API's default row limit. It includes an explicit allowlist of:

- account/profile fields, billing status (without Stripe identifiers), usage counters, the account's chat history, support tickets, notifications, and non-secret device metadata;
- babies owned by the account, their onboarding preferences, sleep logs, daily plans, sleep-plan profiles, and change events;
- caregiver-share state without invite tokens, caregiver emails, or caregiver profile identifiers; and
- only the signed-in person's attributed sleep-log contributions for babies shared by another family.

The export deliberately excludes authentication metadata, service credentials, push endpoints/keys, invite token hashes, Stripe customer/subscription IDs, other caregivers' identifiers, and other caregivers' contributions to a shared-family baby.

### Right to Rectification (Correction)
Users can correct their own profile name, baby details, and onboarding preferences via the Profile UI at any time.

### Right to Erasure (Deletion)
Somni provides two levels of deletion:
1. **Delete Baby Profile**: Performs one owner-scoped delete of the parent `babies` row. Database `ON DELETE CASCADE` constraints remove its logs, plans, preferences, plan profiles/change events, and shares atomically.
2. **Delete Account**: Requires the server to re-check the authenticated user and the `DELETE ACCOUNT` confirmation. It removes email-only pending invitations, deletes the Stripe customer (immediately cancelling active subscriptions), and only then deletes the Supabase Auth user. If billing cleanup fails, the auth account is deliberately retained so an active paid subscription can never be orphaned. Database `ON DELETE CASCADE` constraints then remove the profile and account-owned application data.

Accounts without a profile/subscription row are handled safely. Stripe's final `customer.subscription.deleted` webhook is also acknowledged when its local profile has already been removed.

### Right to Revoke Caregiver Access
A primary caregiver can revoke any invited secondary caregiver's access instantly via the **Profile > Caregiver Access** section. This deletes the `baby_shares` record, immediately terminating their dashboard access.

## 3. Handling Law Enforcement or Manual Requests

If a user requests a manual GDPR deletion, verify control of the address on file and use the self-service flow while impersonation/access controls are in place. If an operator must perform it manually, they must follow the same order: remove email-only pending invitations, delete the Stripe customer and verify cancellation, then delete the Supabase Auth user. Deleting only the Supabase user can orphan an active paid subscription and is prohibited.

Structured application logs redact known account, baby, email, billing, and credential fields, but operators must still treat logs and AI-generated text as potentially personal data. Alpha 1.2 does not claim that telemetry or generated text contains zero PII. Provider-side retention and backup expiry must be handled under the relevant processor agreements and backup runbook.
