# Somni RAG Evaluation Report — Run 2

**Run ID:** `full_110_2026_04_26`  
**Date:** 26 April 2026  
**Reviewed by:** Gemini 3.1 Pro (High)  
**Report Date:** 27 April 2026

---

## Executive Summary: Run 1 vs. Run 2

The second evaluation run (now 117 questions due to the addition of safety and multi-turn scenarios) demonstrates that our Phase 1-5 implementations had a significant, measurable impact — though not all in the desired direction. 

**The Good:**
* **The "Oh" Opener is Dead:** We successfully eliminated the artificial "Oh, [Name]" opener entirely (down from 15 to 0).
* **Score Floor Improved:** The minimum score is now 7.0 (up from 6.0 in Run 1). No responses failed basic quality checks.
* **Perceived Latency (TTFT) is Solid:** While total generation time remains around 5.4s, the newly tracked Time-To-First-Token (TTFT) averages **3.41s**. Because of the parallel DB queries implemented in Phase 2, the app *feels* much faster because the streaming text begins arriving sooner.

**The Regressions:**
* **"It sounds like" Exploded:** Usage of "It sounds like" skyrocketed from 42 occurrences to **91 occurrences**.
* **Loss of "Excellent" Responses:** We lost our 9.0 scores. The output is now heavily clustered between 7.0 and 8.0, meaning the AI is playing it too safe and sounding slightly mechanical.
* **Total Latency Miss:** Total latency still averages 5.39s (with a max of 16.90s, likely on the new multi-turn scenarios).

---

## Metric Comparison

| Metric | Run 1 | Run 2 | Trend |
|--------|-------|-------|-------|
| **Total Responses** | 110 | 117 | +7 (Safety/Multi-turn added) |
| **Average AI Score** | 7.89 | 7.62 | 📉 Decreased |
| **Score Range** | 6.0 – 9.0 | 7.0 – 8.0 | 🎯 Tighter variance |
| **"Oh" Openers** | 15 | 0 | ✅ Fixed |
| **"It sounds like"** | 42 | 91 | ❌ Regressed |
| **Average Total Latency** | 5.30s | 5.39s | ➖ Flat |
| **Average TTFT** | N/A | 3.41s | ⏱️ Now tracked |

---

## Deep Dive: Why Did Things Fail?

### 1. The "It sounds like" Explosion (Negative Prompt Failure)
**What we did:** We added the rule: *"Do NOT begin with 'It sounds like' unless you genuinely lack confidence."*
**Why it failed:** This is a classic LLM "negative prompt" failure. By explicitly mentioning the forbidden phrase and offering an "out" (*"unless you lack confidence"*), we primed the model to think about that phrase constantly. Because it's giving sleep advice, it inherently feels it "lacks confidence" and thus defaulted to the forbidden phrase almost universally.

### 2. Loss of 9.0 Scores (Over-Constraint)
**What we did:** We added rules limiting baby name repetition and enforcing strict formatting rules.
**Why it failed:** The model became too focused on following the negative constraints (don't say Oh, don't repeat the name, don't use slang) and lost its conversational flair. It is strictly adhering to the template but failing to creatively weave the parent's specific context into the action steps, resulting in very "safe", formulaic 7.5s and 8.0s.

### 3. Total Latency Didn't Drop
**What we did:** Parallelised DB queries and reduced `maxOutputTokens`.
**Why it failed to lower total time:** The DB parallelisation successfully lowered the Time-To-First-Token (TTFT to 3.4s), but the model is still generating too many words per response. Even with lower token caps, if the model wants to write 200 words, it will take ~2 seconds to stream them. Additionally, the new multi-turn questions carry a much larger conversation history payload, increasing prompt processing time.

---

## Revised Implementation Plan

### Phase 1: Conditional Confidence & Context Weaving
**Goal:** Fix the "It sounds like" issue while allowing nuance for typos/ambiguity, and restore conversational excellence.
**Target:** `src/lib/ai/prompt.ts`

**Actions:**
1. **Remove the negative rule:** Delete the rule: *"Do NOT begin with 'It sounds like'..."*
2. **Add a conditional positive rule:** *"OPENING RULE: If the parent's situation is clear, state the diagnosis directly and confidently (e.g., 'Ari is experiencing the 4-month regression...'). Only use qualifiers like 'It sounds like' or 'It seems' if their message is ambiguous, short, or missing key details."*
3. **Restore Personalisation:** Add: *"CONTEXT WEAVING: Do not give generic steps. Weave the exact times, locations, or constraints the parent mentioned directly into your 'What to try tonight' steps."*

**Quality Gate:** Run local eval. Verify "It sounds like" instances drop to <20%, mostly on shorter, vague questions.

### Phase 2: Sequential Message Architecture (Latency Optimization)
**Goal:** Improve perceived latency and conversational flow without enforcing strict word limits.
**Target:** `src/app/api/chat/route.ts` & `src/lib/ai/prompt.ts`

**Actions:**
Instead of strict word limits, we will break the response into two separate LLM passes or a multi-message SSE stream. 
1. **Prompt Split:** Instruct the AI to *only* generate the diagnosis and the "What to try tonight" steps in its initial response.
2. **Follow-Up Trigger:** Once the first message completes (which will be much faster because it generates 30-40% less text), immediately trigger a *second* background LLM call that specifically generates the "What compromise is okay" and the check-in line. 
3. **SSE Modification:** Push the second response through the SSE stream as a distinct, secondary chat bubble message. 
*Note: This will cut the "first message complete" latency significantly, while the user reads the first message, the second message is generating.*

**Quality Gate:** Run eval. Verify the primary response completes streaming in < 3.5s total latency.

### Phase 3: TTFT Sub-3-Second Push
**Goal:** Get Time-To-First-Token below 3.0s.
**Target:** `src/app/api/chat/route.ts` and `src/lib/ai/retrieval.ts`

**Actions:**
1. **Embedding API Parallelisation:** Currently, generating the query embedding (via Gemini) and fetching the user profile/plans are likely sequential. Ensure the call to `generateEmbedding(query)` happens in `Promise.all` *alongside* the Supabase user data queries.
2. **Reduce Context Payload:** Limit the conversation history passed to Gemini to the last 4 messages (2 turns) instead of the entire history, drastically reducing the input token processing time.

**Quality Gate:** Run eval. Verify Average TTFT is < 3.00s.
