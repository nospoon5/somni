# Somni Support & Incident Triage

## Support Inbox Workflow

When users experience issues, they can submit reports via the `/support` page form in the application.

> **Stage 7 status (19 July 2026):** The earlier RLS failure was fixed. The route now counts recent
> submissions through a server-only admin client, inserts through the signed-in user's RLS scope
> without requesting the inserted row, and fails closed if the rate-limit count cannot be verified.
> `tests/e2e/support.spec.ts` covers one exact submission and cleanup with a pre-created account.
> This test does not prove that the production deployment is current, that anyone is monitoring the
> inbox, or that a fallback contact path exists.

### 1. Where do tickets go?
Support requests are stored directly in the `support_tickets` database table. There is **no email
forwarding** at this stage. An authorised admin can use `/admin/support`; the Supabase Table
Editor remains a diagnostic fallback.

There is no repository-configured support alert, shared mailbox, paging integration, or assigned
response owner. Before launch, record a named primary and backup reviewer, review frequency,
response target, escalation route, and privacy-approved fallback contact method. Until then, an
unread ticket can remain unnoticed even though database insertion works.

### 2. How to review incoming tickets
1. Sign in with an authorised admin profile and open `/admin/support`.
2. If the admin page is unavailable, use Supabase **Table Editor** and select `support_tickets`.
3. Start with tickets whose status is `open`.
4. Review the details provided:
   - `category`: e.g., 'bug', 'feedback', 'billing', 'other'
   - `message`: The user's detailed description of the issue.
   - `origin_page`: The page they were on immediately prior to clicking support.
   - `user_agent`: Basic device/browser info.
5. Treat ticket contents and user-agent data as sensitive operational data. Do not paste raw
   messages, identifiers, or baby details into a general issue tracker or chat channel.

### 3. Triage Steps
1. **Classify impact**: Escalate credible cross-account data access, unsafe advice with serious-harm
   potential, or catastrophic data loss as SEV-1. Follow
   [Incident Response](incident_response.md). Treat sustained core-flow or billing failure as at
   least SEV-2 until scoped.
2. **Identify the minimum record**: Use `profile_id`, timestamps, route, and request identifiers to
   narrow the issue. Do not open chat messages or sleep details unless they are necessary for the
   investigation and the responder is authorised to view them.
3. **Preserve evidence safely**: Record redacted logs and provider event IDs. Never copy passwords,
   cookies, auth tokens, invitation tokens, push endpoints, Stripe identifiers, or raw family data.
4. **Change status**: Move the ticket from `open` to `in_progress`, `resolved`, or `closed` as work
   proceeds. A status change is not a user response.
5. **Respond carefully**: If using the submitted email manually, confirm that this is an approved
   support contact method and avoid sensitive details in email. No automated response or outbound
   support integration is implemented.
6. **Verify resolution**: Reproduce the original path with a pre-created test account where safe,
   confirm the fix, and record the evidence before closing the ticket.

## General Production Monitoring

The repository has structured, redacted server logging, but it does not deliver alerts. The checks
below are manual until a monitored alert destination and responsible people are configured and
tested.

1. **Vercel Runtime Logs**
   - Head to Vercel -> Somni Project -> Logs.
   - Look for **500 API errors** (server crashes).
   - Investigate repeated timeouts on `/api/chat`; do not assume their cause without request and
     provider evidence.
   - Look for structured entries with `actionRequired: true`. This field is a search aid, not an
     alert delivery mechanism.

2. **Supabase Postgres Logs**
   - Check Supabase -> Logs -> Postgres Logs.
   - Investigate row-level-security errors and database deadlocks. An RLS error can indicate a code,
     policy, fixture, or session problem; it is not enough on its own to identify the cause.

3. **Stripe Billing Failures**
   - Check Stripe dashboard for `failed` webhook deliveries under Developer -> Webhooks.
   - Use [Billing Reconciliation](billing_reconciliation.md) when Stripe and Somni disagree. There
     is no supported bulk or single-user reconciliation script yet.

## Launch evidence still required

- A production support submission creates exactly one ticket and appears in `/admin/support`.
- The assigned reviewer notices it within the agreed interval and can update its status.
- A privacy-approved user response and fallback contact path work.
- A simulated urgent report reaches the assigned incident contact through a tested escalation path.
- The retention and deletion treatment for support records is confirmed against the account-data
  export/deletion behaviour and the privacy notice.

Until those checks pass, support collection is technically available but not operationally ready.
