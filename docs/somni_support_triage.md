# Somni Support & Incident Triage

## Support Inbox Workflow

When users experience issues, they can submit reports via the `/support` page form in the application.

> **Known Alpha 1.2 blocker:** At the 17 July 2026 review, normal-user submission returned HTTP
> 500 because the insert requested a returned row that RLS did not allow the user to select. Do
> not assume the inbox is receiving tickets until Alpha 1.2 S0.1 is complete and the submission
> smoke check passes.

### 1. Where do tickets go?
Support requests are stored directly in the `support_tickets` database table. There is **no email
forwarding** at this stage. An authorised admin can use `/admin/support`; the Supabase Table
Editor remains a diagnostic fallback.

### 2. How to review incoming tickets
1. Sign in with an authorised admin profile and open `/admin/support`.
2. If the admin page is unavailable, use Supabase **Table Editor** and select `support_tickets`.
3. Start with tickets whose status is `open`.
4. Review the details provided:
   - `category`: e.g., 'bug', 'feedback', 'billing', 'other'
   - `message`: The user's detailed description of the issue.
   - `origin_page`: The page they were on immediately prior to clicking support.
   - `user_agent`: Basic device/browser info.

### 3. Triage Steps
1. **Identify the profile**: Use `profile_id` to look up their session history or recent interactions in the `messages` table, if their issue is related to the AI chat.
2. **Prioritise Critical Bugs**: If a ticket mentions payment failure, data loss, or the dashboard crashing, address it immediately.
3. **Change Status**: After addressing an issue or filing it away into your issue tracker, change the `status` column in Supabase from `open` to `in_progress`, `resolved`, or `closed` to maintain inbox zero.
4. **Respond**: Reach out to the user using the email provided in the `email` column if appropriate.

## General Production Monitoring

To ensure beta users have a smooth experience, regularly review the following points behind the scenes.

1. **Vercel Runtime Logs**
   - Head to Vercel -> Somni Project -> Logs.
   - Look for **500 API errors** (server crashes).
   - Occasional timeouts on `/api/chat` might occur if Vercel functions take too long, but excessive 504 errors indicate an LLM timeout and that prompts or RAG contexts are becoming too heavy.

2. **Supabase Postgres Logs**
   - Check Supabase -> Logs -> Postgres Logs.
   - Keep an eye out for missing RLS policies (`new row violates row-level security policy`) or database deadlocks. It normally means a newly added feature lacks correct Auth permissions in productions.

3. **Stripe Billing Failures**
   - Check Stripe dashboard for `failed` webhook deliveries under Developer -> Webhooks.
   - If user accounts exist in Somni but not in Stripe, ensure they finished the checkout flow.

*Alpha 1.2 Stage 6 must replace informal monitoring assumptions with an approved operational
setup, response targets, escalation ownership, and a fallback contact path.*
