# Somni Support & Incident Triage

## Support Inbox Workflow

When users experience issues, they can submit reports via the `/support` page form in the application.

### 1. Where do tickets go?
As of Beta Readiness (Section 5), support requests are stored directly in the `support_tickets` database table.
There is **no email forwarding** at this stage. You must proactively query this table to review user feedback or bug reports.

### 2. How to review incoming tickets
1. Log in to your Supabase project dashboard and navigate to the **Table Editor**.
2. Select the `support_tickets` table.
3. Filter by `status = 'open'`.
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

*Note: As Somni scales, a formal error monitoring service like Sentry and an email ticketing system like Resend should be implemented to replace manual log-checking.*
