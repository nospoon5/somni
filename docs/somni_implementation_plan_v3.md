# Somni - Implementation Plan V3 (Advanced AI & Polish)

## Goal
Evolve Somni from a static RAG app into a highly contextual, proactive sleep coaching assistant with long-term memory, an organic daily scheduling tool, and the distinct tonal footprint of Elyse Sleep. Additionally, execute crucial UI polish and technical robustness updates.

> [!NOTE]
> This plan is designed to be executed sequentially by CODEX. Each stage includes strict Quality Control Gates that must pass before progression.

---

## Stage 7: Project Polish & Tech Debt

### Goal
Resolve pending technical debt, improve data integrity, and finalize the visual brand refresh before adding new AI complexity.

### Tasks and Actions
- [~] **Option A: Finish the Brand Refresh (Deferred by product decision on 2026-04-06)**
  - Translate the final PNG logos into crisp SVGs (`public/somni-icon.svg`, `public/somni-logo-light.svg`, `public/somni-logo-dark.svg`).
  - Replace PNG `<img>` references across the app (nav bar, landing header, auth headers) with these SVGs.
- [x] **Option B: Database Constraints**
  - Create a Supabase migration to add a partial unique index on the `sleep_logs` table.
  - This index should prevent a baby from having two "Currently sleeping" sessions by guaranteeing a single `baby_id` can only ever have one active row where `ended_at IS NULL`.
- [x] **Option C: Decoupling Chat from Billing**
  - Refactor `/app/(authenticated)/chat/page.tsx` (and layout if necessary).
  - Ensure that if the billing configuration/Stripe fetch fails or is missing, the chat page renders in a safe read-only or degraded mode instead of crashing entirely.

### Quality Control Gates
- [~] Navigation and auth headers render the new SVGs correctly without blurriness on mobile/desktop. (Deferred with Option A)
- [x] Direct database insertion testing confirms a second `ended_at IS NULL` log for the same baby throws a Postgres error.
- [x] Force a Stripe/billing fetch failure locally and confirm the `/chat` page loads gracefully instead of throwing a generic Next.js 500 error screen.

### Stage 7 Execution Notes (2026-04-06)
- Added migration `supabase/migrations/20260406_sleep_logs_single_active_session.sql` with guard + partial unique index `sleep_logs_single_active_session_idx` on `(baby_id) WHERE ended_at IS NULL`.
- Applied migration to remote project and verified expected Postgres failure for second active log insert (`SQLSTATE 23505`).
- Updated chat page and coach UI for graceful billing degradation:
  - `src/app/chat/page.tsx`
  - `src/components/chat/ChatCoach.tsx`
  - `src/components/chat/ChatCoach.module.css`
- Added temporary verification toggle for local QA: `SOMNI_FORCE_BILLING_FAILURE=1`.
- Fixed migration sequencing issue (duplicate `20260403` version) by renaming corpus function migration to `20260404_add_corpus_match_function.sql`.

---

## Stage 8: AI Persona & Corpus Enrichment

### Goal
Infuse Somni with the exact tonal characteristics and specific methodologies (no micro-naps, 10-minute wait) from Elyse's consulting style.

### Tasks and Actions
- [x] **Corpus Additions:** Create `corpus/chunks/10_minute_wait_and_assess.md` to formalize that giving a baby 10 minutes is about giving them space to practice self-settling, not crying-it-out.
- [x] **Corpus Additions:** Create `corpus/chunks/avoiding_micro_naps.md` explaining the severe impact of 2-second micro-naps on sleep drive and advising pushing nap schedules back if they happen.
- [x] **Persona Review:** The parent will read, adjust, and finalize the `docs/somni_ai_persona.md` document.
- [x] **Persona Injection:** Once approved, update `src/lib/ai/prompt.ts`. Add Elyse's tonal characteristics straight from the finalized persona document. **Crucially, implement conditional logic using the `sleepStyleLabel` to dynamically adjust the prompt's tone (Gentle, Balanced, Fast-Track) as outlined in the persona document.**
- [x] **Clarification Guardrail:** Update the system prompt to explicitly command: *"Before offering a plan, evaluate if critical context is missing. If missing, ask EXACTLY ONE clarifying question. DO NOT guess."*

### Quality Control Gates
- [x] The two new markdown chunks are successfully uploaded and embedded into the Supabase `corpus_chunks` table via the uploader script.
- [x] Sending a chat with missing context (e.g., "My baby woke up early") results in the AI asking one focused follow-up question instead of hallucinating advice.
- [x] Chat outputs heavily reflect the new warm, empathetic Persona.

### Stage 8 Execution Notes (2026-04-07)
- Confirmed corpus files exist in repo:
  - `corpus/chunks/10_minute_wait_and_assess.md`
  - `corpus/chunks/avoiding_micro_naps.md`
- Confirmed uploaded chunk records in Supabase `corpus_chunks`:
  - `chunk_id=10-minute-wait-and-assess`
  - `chunk_id=avoiding-micro-naps`
- Confirmed prompt persona behavior in `src/lib/ai/prompt.ts`:
  - Elyse-style warmth and language constraints
  - dynamic style guidance for `gentle`, `balanced`, `fast-track`
  - explicit one-question missing-context guardrail
- Verified missing-context behavior with live chat check (`"My baby woke up early"`):
  - assistant returned exactly one focused clarifying question (`?` count: 1).

---

## Stage 9: AI Memory Extractor (Master Profile)

### Goal
Give Somni long-term, token-efficient memory of the baby's specific facts without needing to pass the entire chat history.

### Tasks and Actions
- [x] Create a migration adding an `ai_memory` (TEXT) column to the `babies` table.
- [x] Create `src/lib/ai/memory.ts` containing a lightweight fact-extraction prompt. 
- [x] Update `src/app/api/chat/route.ts` to trigger the extractor asynchronously *after* the main chat stream closes. It will read the latest user/assistant messages and intelligently append/update facts in `babies.ai_memory`.
- [x] Update `src/lib/ai/prompt.ts` to inject the `ai_memory` string directly into the system context.

### Quality Control Gates
- [x] The `ai_memory` column exists in Supabase.
- [x] After a user tells Somni, "Elly rolled on her tummy today," checking the Supabase table visually confirms this fact was appended to the memory string.
- [x] In a new chat session (where history isn't loaded), Somni is still aware the baby rolled on her tummy based purely on the `ai_memory` injection.

### Stage 9 Hardening Addendum (2026-04-07)
- [x] **Hybrid persistence reliability patch (recommended):**
  - Attempt `ai_memory` persistence synchronously for a short latency budget (target ~1.2s max).
  - If persistence does not complete within budget, fall back to background completion so parent-facing response speed remains stable.
  - Rationale: materially improves write reliability versus pure post-close async, while keeping UX impact small.
- [~] **Future reliability upgrades (tracked):**
  - Introduce a durable queue/job worker for memory writes (highest reliability, higher complexity).
  - Add retry/backfill job to reprocess recent conversations and repair missed memory updates.
- [x] **Scheduled retry/backfill job (implemented 2026-04-07):**
  - Added secure cron endpoint at `/api/cron/memory-backfill` (requires `Authorization: Bearer ${CRON_SECRET}`).
  - Added Vercel cron schedule: every 12 hours (`0 */12 * * *`).
  - Frequency rationale: catches rare missed writes same-day with lower model-call overhead than 6-hour cadence.

### Stage 9 Execution Notes (2026-04-07)
- Added migration `supabase/migrations/20260407_add_babies_ai_memory.sql` and applied to remote Supabase.
- Added extractor module: `src/lib/ai/memory.ts`.
- Updated chat route (`src/app/api/chat/route.ts`) to:
  - include `ai_memory` in prompt context,
  - persist memory updates with hybrid reliability (short sync budget + async fallback),
  - support scheduled repair path.
- Updated prompt injection (`src/lib/ai/prompt.ts`) with `Master memory profile`.
- Verified with test profile `tester1@test.com` / baby `Elly`:
  - `ai_memory` contains `- Elly rolled onto her tummy today.`
  - fresh conversation still references the rolling milestone from memory.

---

## Stage 10: Organic Logging & Dashboard Targets (Tool Calling)

### Goal
Allow the AI to organically gather sleep updates via conversation and save them as a "Dashboard Target Plan" to keep caregivers aligned.

### Tasks and Actions
- [ ] Create a migration adding a `daily_plans` table (`id`, `baby_id`, `plan_date`, `sleep_targets` JSON, `feed_targets` JSON, `notes`). This allows historical tracking.
- [ ] Build UI components on the Dashboard to fetch and display the `daily_plans` for the current date.
- [ ] Update `src/lib/ai/prompt.ts` or route to expose a `FunctionDeclaration` (`update_daily_plan`) to the Gemini model.
- [ ] Update the SSE stream handler in `src/app/api/chat/route.ts` to detect `functionCall` responses.
- [ ] Write the logic so when Gemini decides to update the plan, the backend executes the Supabase insert/update to `daily_plans`, alerts the client (via a specialized SSE event), and completes the response.

### Quality Control Gates
- [ ] The new Dashboard UI correctly renders an active daily plan or an empty state if no plan exists.
- [ ] When a user chats "Elly had a terrible morning, let's push her afternoon nap to 3pm", the SSE stream successfully triggers the `update_daily_plan` tool.
- [ ] The database accurately reflects the requested changes in the `daily_plans` table for the current date.
- [ ] The Dashboard UI automatically or cleanly updates to show the revised targets without corrupting past historical days.
