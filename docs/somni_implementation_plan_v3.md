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
- [ ] **Corpus Additions:** Create `corpus/chunks/10_minute_wait_and_assess.md` to formalize that giving a baby 10 minutes is about giving them space to practice self-settling, not crying-it-out.
- [ ] **Corpus Additions:** Create `corpus/chunks/avoiding_micro_naps.md` explaining the severe impact of 2-second micro-naps on sleep drive and advising pushing nap schedules back if they happen.
- [ ] **Persona Review:** The parent will read, adjust, and finalize the `docs/somni_ai_persona.md` document.
- [ ] **Persona Injection:** Once approved, update `src/lib/ai/prompt.ts`. Add Elyse's tonal characteristics straight from the finalized persona document. **Crucially, implement conditional logic using the `sleepStyleLabel` to dynamically adjust the prompt's tone (Gentle, Balanced, Fast-Track) as outlined in the persona document.**
- [ ] **Clarification Guardrail:** Update the system prompt to explicitly command: *"Before offering a plan, evaluate if critical context is missing. If missing, ask EXACTLY ONE clarifying question. DO NOT guess."*

### Quality Control Gates
- [ ] The two new markdown chunks are successfully uploaded and embedded into the Supabase `corpus_chunks` table via the uploader script.
- [ ] Sending a chat with missing context (e.g., "My baby woke up early") results in the AI asking one focused follow-up question instead of hallucinating advice.
- [ ] Chat outputs heavily reflect the new warm, empathetic Persona.

---

## Stage 9: AI Memory Extractor (Master Profile)

### Goal
Give Somni long-term, token-efficient memory of the baby's specific facts without needing to pass the entire chat history.

### Tasks and Actions
- [ ] Create a migration adding an `ai_memory` (TEXT) column to the `babies` table.
- [ ] Create `src/lib/ai/memory.ts` containing a lightweight fact-extraction prompt. 
- [ ] Update `src/app/api/chat/route.ts` to trigger the extractor asynchronously *after* the main chat stream closes. It will read the latest user/assistant messages and intelligently append/update facts in `babies.ai_memory`.
- [ ] Update `src/lib/ai/prompt.ts` to inject the `ai_memory` string directly into the system context.

### Quality Control Gates
- [ ] The `ai_memory` column exists in Supabase.
- [ ] After a user tells Somni, "Elly rolled on her tummy today," checking the Supabase table visually confirms this fact was appended to the memory string.
- [ ] In a new chat session (where history isn't loaded), Somni is still aware the baby rolled on her tummy based purely on the `ai_memory` injection.

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
