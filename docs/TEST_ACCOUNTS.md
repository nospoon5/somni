# Somni Test Accounts

When testing Somni app features (especially via browser subagents), use the following pre-created test accounts instead of attempting to sign up a new account. This saves time and avoids rate limits.

## Profile 1 - Gentle
- **Email:** `gentletester@test.com`
- **Password:** `gentletester123`
- **Name:** Gentle Tester
- **Baby Name:** GT (DOB: 30 - 08 - 2025)
- **Settings:** Feeding: Breast | Typical Bedtime: Varies | Biggest Issue: Something Else

## Profile 2 - Balanced
- **Email:** `balancedtester@test.com`
- **Password:** `balancedtester123`
- **Name:** Balanced Tester
- **Baby Name:** Aria (DOB: 28 - 02 - 2026)
- **Settings:** Feeding: Breast | Typical Bedtime: Varies | Biggest Issue: Something Else

## Profile 3 - Fast Track
- **Email:** `fasttester@test.com`
- **Password:** `fasttester123`
- **Name:** Fast Tester
- **Baby Name:** FT (DOB: 30 - 12 - 2025)
- **Settings:** Feeding: Breast | Typical Bedtime: Varies | Biggest Issue: Something Else

**Notes on usage:**
- These accounts are persisted in the Supabase instance.
- Test sleep logs, plans, invitations, notification state, and usage counters are shared mutable
  state and may differ from the descriptive snapshot above.
- Prefer resetting only the minimum fixture data required for the scenario. Do not create new
  auth users or extra baby profiles during routine testing.
- Use separate browser contexts for multi-caregiver tests; never paste credentials into logs,
  screenshots, commits, or handoff documents.
- Do not change the passwords.
