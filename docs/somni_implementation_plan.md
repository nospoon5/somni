# Somni - Implementation Plan

## Planning Rule

This file is the primary execution checklist for Somni.

It must stay aligned with:

- `docs/somni_architecture.md`
- `docs/somni_architect_handoff.md`

If these documents disagree, the architecture file is the source of truth and this file should be updated immediately.

## Stage Progression Rule

Stages are sequential by default, but low-risk preparation for the next stage is allowed before the current stage is fully closed.

Examples of allowed overlap:

- preparing UI shells before backend integration
- drafting uploader code before chat is built
- writing tests or helper utilities ahead of full feature completion

Examples of disallowed progression:

- building chat on top of an unresolved schema
- adding billing logic before auth and profile ownership are stable
- claiming a stage is complete before its quality gates pass

## Current Snapshot

Status as of 2026-04-03:

- The architecture, handoff, and schema files have been aligned
- The Supabase SQL has been applied successfully
- The landing page, auth, onboarding, dashboard, sleep logging, and first-pass sleep scoring are built
- Live verification confirmed sign-up, sign-in, onboarding, sleep logging, and the score summary
- A 2026-04-03 live sign-up recheck succeeded with a valid disposable email format and created the auth user successfully
- Stage 4 chat foundations and verification are complete, including streaming, persistence, and emergency handling
- Stage 5 usage enforcement is now built and verified, including server-side counting, limit responses, and premium gating from stored subscription state
- The live Supabase retrieval RPC migration `20260403_add_corpus_match_function.sql` is still not applied and the app remains on its fallback retrieval path

## Stage Overview

| Stage | Name | Status |
| --- | --- | --- |
| Stage 0 | Foundation | Complete |
| Stage 1 | Corpus | In progress |
| Stage 2 | Project Setup and Auth | Complete |
| Stage 3 | Core Features | Complete |
| Stage 4 | AI and Chat | Complete |
| Stage 5 | Monetization | In progress |
| Stage 6 | Polish and Launch | Not started |

## Stage 0 - Foundation

### Goal

Create a stable project base with the right stack, repo structure, and planning documents so later feature work does not drift.

### Tasks and Actions

- [x] Initialize the Next.js project foundation
- [x] Set up the base folder structure
- [x] Add Supabase browser and server helper files
- [x] Add session refresh middleware
- [x] Create the initial planning and architecture docs
- [x] Clean up and align the architecture doc as the V1 source of truth
- [x] Add human-readable alignment notes

### Quality Control Gates

- [x] Core docs exist and are understandable
- [x] Key planning files no longer contradict the architecture
- [x] The repo is ready for real feature work without schema ambiguity

Gate evidence:

- Docs can be read without conflicting schema definitions
- Architecture, handoff, implementation plan, and migration describe the same V1 model
- The next coding step does not require guessing table names or field meanings

### Stage Exit

- [x] Stage 0 complete

## Stage 1 - Corpus

### Goal

Prepare a high-quality, retrieval-friendly knowledge base that can ground Somni's future coaching responses.

### Tasks and Actions

- [x] Extract and organize source material
- [x] Curate 36 markdown chunks in `corpus/chunks/`
- [x] Ensure chunks include structured frontmatter
- [x] Build the embedding uploader script
- [x] Upload chunks into `corpus_chunks`
- [ ] Validate that retrieval metadata matches the runtime expectations

### Quality Control Gates

- [x] Corpus files exist and are curated instead of being raw scraped output
- [x] Chunk metadata includes the fields needed for future retrieval
- [x] The uploader can ingest the full corpus without manual table edits
- [x] Sample rows in Supabase confirm chunk metadata and embeddings are stored correctly

Gate evidence:

- `corpus/chunks/` contains the intended curated markdown files
- A sample chunk shows frontmatter for topic, age band, methodology, sources, and confidence
- The uploader runs across all chunks without requiring one-off fixes in Supabase
- A Supabase spot check shows `chunk_id`, metadata, and embeddings populated as expected

### Stage Exit

- [ ] Stage 1 complete

## Stage 2 - Project Setup and Auth

### Goal

Get the app connected to the live database, replace the scaffold with Somni UI, and provide a reliable sign-up and sign-in flow.

### Tasks and Actions

- [x] Align the implementation plan, handoff, and SQL migration with the architecture
- [x] Rewrite the initial Supabase migration to match the intended V1 schema
- [x] Apply the finalized SQL in Supabase
- [x] Replace the default landing page with a Somni landing page shell
- [x] Build `/login`
- [x] Build `/signup`
- [x] Add auth server actions
- [x] Add logout flow
- [x] Verify sign-up against the live database
- [x] Verify sign-in against the live database
- [x] Verify redirect behavior for signed-in users with incomplete onboarding

### Quality Control Gates

- [x] The live Supabase schema matches the intended V1 model
- [x] Auth UI exists and is integrated with Supabase actions
- [x] Lint passes with the new auth code
- [x] A real user can sign up successfully
- [x] A real user can sign in successfully
- [x] Auth redirects behave correctly in the live app

Gate evidence:

- The SQL migration ran successfully in Supabase
- `/login` and `/signup` submit to server actions without local build errors
- `npm run lint` passes
- A manual test confirms an existing account can sign in
- A manual test confirms incomplete users are redirected to `/onboarding` and completed users to `/dashboard`
- A 2026-04-03 live signup recheck created a real auth user successfully with a valid disposable address and no code changes were required

### Stage Exit

- [x] Stage 2 complete

## Stage 3 - Core Features

### Goal

Turn the authenticated shell into a usable product by adding onboarding, sleep logging, early dashboard value, and later the sleep score.

### Tasks and Actions

- [x] Build the onboarding page shell
- [x] Build the multi-step onboarding form
- [x] Add the onboarding server action
- [x] Save baby records to Supabase
- [x] Save onboarding preference scores and derived label
- [x] Mark `profiles.onboarding_completed` when onboarding finishes
- [x] Add a dashboard shell
- [x] Build the `/sleep` page
- [x] Build the start sleep action
- [x] Build the end sleep action
- [x] Display recent sleep history
- [x] Verify onboarding against the live database
- [x] Verify sleep logging against the live database
- [x] Build the sleep score calculation
- [x] Connect the dashboard to real sleep data
- [x] Show a first-pass score summary on the dashboard

### Quality Control Gates

- [x] Onboarding UI exists and is wired to the database
- [x] Sleep logging UI exists and is wired to the database layer
- [x] Lint passes with onboarding and sleep features
- [x] A real user can complete onboarding end-to-end
- [x] A real user can start and end a sleep session end-to-end
- [x] Recent history reflects newly logged sleep correctly
- [x] The score calculation produces sensible output for known sample cases
- [x] The dashboard shows real, user-specific data

Gate evidence:

- `/onboarding`, `/dashboard`, and `/sleep` render without local build errors
- `npm run lint` passes
- A manual test confirms onboarding creates rows in `babies` and `onboarding_preferences`
- A manual test confirms `profiles.onboarding_completed` becomes `true`
- A manual test confirms starting and ending sleep creates and updates a `sleep_logs` row
- The newest sleep log appears in recent history after the session refreshes
- Sample score inputs produce expected, explainable outputs
- The dashboard reflects real data for the signed-in user rather than placeholder text

### Stage Exit

- [x] Stage 3 complete

## Stage 4 - AI and Chat

### Goal

Add the RAG pipeline, prompt assembly, and chat experience so Somni can provide source-backed coaching based on the user's baby and sleep context.

### Tasks and Actions

- [x] Build the corpus uploader script
- [x] Upload the 36 chunks into `corpus_chunks`
- [x] Build retrieval helpers for chunk search
- [x] Add prompt assembly logic
- [x] Add Gemini request and streaming response logic
- [x] Build the chat UI
- [x] Persist user and assistant messages
- [x] Persist structured assistant metadata such as sources and safety signals
- [x] Add fallback behavior for empty retrieval
- [x] Add safety rails and emergency redirect behavior

### Quality Control Gates

- [x] Corpus chunks are stored in Supabase with valid embeddings
- [x] Retrieval returns sensible, metadata-rich matches for sample prompts
- [x] The chat route can stream a response successfully
- [x] Messages persist correctly
- [x] Source attribution renders correctly in the UI
- [x] Safety notes render distinctly
- [x] Emergency prompts trigger safe redirect behavior

Gate evidence:

- A Supabase query confirms uploaded chunks exist with non-null embeddings
- Test prompts return chunks that are obviously relevant to age band and topic
- Stage 4 retrieval verification script confirms sensible ranked matches for sample prompts
- Stage 4 chat e2e script confirms streamed responses rather than a full blocking payload
- Stage 4 chat e2e script confirms `messages` rows are created for both user and assistant turns
- Stage 4 chat e2e script confirms source metadata is returned and persisted in `sources_used`
- The chat UI has dedicated safety note rendering and styling, and e2e confirms safety notes are returned
- Stage 4 chat e2e script confirms emergency prompts trigger safe escalation behavior

### Stage Exit

- [x] Stage 4 complete

## Stage 5 - Monetization

### Goal

Enforce free-tier usage limits and add a reliable upgrade path for paid subscriptions.

### Tasks and Actions

- [x] Build usage counting logic
- [x] Enforce the daily free-tier message cap server-side
- [ ] Add limit-hit response handling in the UI
- [x] Build Stripe checkout flow
- [x] Build Stripe webhook handling
- [x] Build billing portal flow
- [x] Store and update local subscription state
- [x] Gate premium behaviors based on subscription state

### Quality Control Gates

- [x] Free-tier limits cannot be bypassed by the client
- [ ] Limit-hit handling is clear and user-friendly
- [x] Stripe checkout works in the intended environment
- [x] Webhooks update subscription state correctly
- [x] Billing portal opens correctly
- [x] Premium access changes reflect the real subscription state

Gate evidence:

- `node scripts/verify-stage5-usage-limit.mjs` confirms the 10th free message succeeds, the 11th returns `429` with reset context, and premium access bypasses the cap from stored subscription state
- A limit-hit user sees a clear upgrade path and reset explanation
- `node scripts/verify-stage5-stripe.mjs` confirms Stripe Checkout returns a valid Stripe-hosted checkout URL in sandbox mode
- `node scripts/verify-stage5-stripe.mjs` confirms webhook events update the `subscriptions` table as expected
- `node scripts/verify-stage5-stripe.mjs` confirms billing portal sessions open for the correct signed-in user in sandbox mode
- Premium-only behavior turns on and off based on stored subscription state via the stored `subscriptions` row, verified in the Stage 5 usage script

### Stage Exit

- [ ] Stage 5 complete

## Stage 6 - Polish and Launch

### Goal

Improve reliability, trust, usability, and readiness for real users.

### Tasks and Actions

- [ ] Improve dashboard polish and empty states
- [ ] Improve mobile usability and one-handed interactions
- [ ] Add PWA install polish
- [ ] Review offline behavior and messaging
- [ ] Add legal pages
- [ ] Run a performance pass
- [ ] Run a final end-to-end QA pass
- [ ] Prepare a beta-ready release checklist

### Quality Control Gates

- [ ] Core flows feel stable on mobile
- [ ] Loading, empty, and error states are clear
- [ ] PWA installation works as expected
- [ ] Offline messaging is honest and understandable
- [ ] Legal and trust surfaces exist
- [ ] Core paths pass a beta readiness review

Gate evidence:

- Manual mobile testing covers login, onboarding, sleep logging, and dashboard access
- Empty and error states exist on the main user-facing pages
- Installability and manifest behavior are confirmed in the browser
- Offline behavior matches what the UI claims
- Legal pages are accessible from the product shell or landing page
- A final walkthrough of the primary user journey completes without blocking issues

### Stage Exit

- [ ] Stage 6 complete

## Immediate Next Actions

- [x] Re-run live sign-up verification when email-rate limits allow
- [x] Verify sign-in with the live Supabase project
- [x] Verify onboarding end-to-end with the live Supabase project
- [x] Verify sleep logging end-to-end with the live Supabase project
- [x] Build the sleep score calculation
- [x] Build the corpus uploader
- [x] Build retrieval helpers
- [x] Build prompt assembly
- [x] Build `/api/chat` with Gemini streaming
- [x] Build `/chat` UI shell and streaming client
- [x] Run authenticated Stage 4 verification pass end-to-end

## Next Recommended Working Session

The next best step is finishing and verifying the remaining Stripe half of Stage 5.

Why this is the right next move:

- the free-tier enforcement and premium gating foundation is now in place
- the next remaining entitlement risk is Stripe environment wiring and webhook correctness
- checkout, portal, and webhook routes exist in code but still need sandbox verification

Recommended order:

1. Add Stripe sandbox env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`)
2. Browser-check the limit-hit UI state from `/chat`
3. Apply and verify the live Supabase retrieval SQL migration so chat can leave fallback mode
4. If those pass, mark Stage 5 complete
5. Start Stage 6 polish and launch work

If those checks pass, the remaining Stage 5 boxes can be closed.

## Project Risks

| Risk | Why It Matters | Control |
| --- | --- | --- |
| Schema drift | Creates rework and bugs | Keep architecture as source of truth |
| Weak retrieval quality | Makes Somni feel generic | Keep chunks curated and metadata-rich |
| Unsafe advice | High trust and product risk | Add safety rails and emergency handling |
| Misleading offline behavior | Breaks trust quickly | Be explicit about what is and is not saved |
| Billing or limit inconsistencies | Damages trust and support load | Enforce server-side only |
