#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

async function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf8").catch(() => "");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 200 || response.status === 401) {
        return;
      }
    } catch {
      // Keep polling until the server is ready.
    }
    await sleep(1000);
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

function base64url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseSseEventBlock(block) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!eventLine || !dataLine) {
    return null;
  }

  const event = eventLine.slice("event:".length).trim();
  const rawData = dataLine.slice("data:".length).trim();

  try {
    return {
      event,
      payload: JSON.parse(rawData),
    };
  } catch {
    return null;
  }
}

async function readSseResponseText(response) {
  if (!response.body) {
    throw new Error("Missing response body for SSE");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamedText = "";
  let donePayloadMessage = "";
  let errorMsg = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseEventBlock(block);
      if (!parsed) continue;

      if (parsed.event === "token") {
        const token = parsed.payload?.text;
        if (typeof token === "string") {
          streamedText += token;
        }
      }
      if (parsed.event === "done") {
        donePayloadMessage = parsed.payload?.message || "";
      }
      if (parsed.event === "error") {
        errorMsg = (parsed.payload?.error || "Error") + ": " + (parsed.payload?.detail || "");
      }
    }
  }

  // Final flush of the decoder
  buffer += decoder.decode();
  const finalBlocks = buffer.split("\n\n");
  for (const block of finalBlocks) {
    const parsed = parseSseEventBlock(block);
    if (!parsed) continue;
    if (parsed.event === "token") streamedText += parsed.payload?.text || "";
    if (parsed.event === "done") donePayloadMessage = parsed.payload?.message || donePayloadMessage;
  }

  if (errorMsg) return "ERROR: " + errorMsg.replace(/"/g, '""');
  const finalMessage = (streamedText.trim() || donePayloadMessage.trim());
  // Escape quotes for CSV and replace newlines with spaces to keep it in one cell
  return `"${finalMessage.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`; 
}

async function waitForProfile(supabaseAdmin, userId, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (data?.id) return;
    await sleep(250);
  }
  throw new Error("Profile row was not created in time for test user");
}

async function main() {
  await loadDotEnvLocal();

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const supabaseAuth = createClient(supabaseUrl, anonKey);

  console.log("Loading test cases...");
  const testCasesRaw = await readFile(path.join(process.cwd(), "scripts", "eval_data", "test_cases.json"), "utf8");
  const testCases = JSON.parse(testCasesRaw);

  const email = `eval-${Date.now()}@somni.test`;
  const password = `SomniEval!${Math.floor(Math.random() * 100000)}`;
  let createdUserId = null;
  let serverProcess = null;

  try {
    console.log("Creating temporary Eval user...");
    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Eval User" },
    });
    if (createUserError) throw new Error(createUserError.message);
    createdUserId = createdUser.user?.id;

    await waitForProfile(supabaseAdmin, createdUserId);

    console.log("Setting Profile Onboarding to complete...");
    await supabaseAdmin.from("profiles").update({ onboarding_completed: true, timezone: "Australia/Sydney" }).eq("id", createdUserId);

    console.log("Seeding premium access to bypass usage limits...");
    await supabaseAdmin.from("subscriptions").insert({
      profile_id: createdUserId,
      plan: "monthly",
      status: "active",
      current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_trial: false,
    });

    const { data: signInData } = await supabaseAuth.auth.signInWithPassword({ email, password });
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const cookieHeader = `sb-${projectRef}-auth-token=base64-${base64url(JSON.stringify(signInData.session))}`;

    console.log("Starting local app server on port 3012...");
    serverProcess = spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3012" }, // Removed the 1.5-flash override, returning to 2.5-flash
      stdio: "inherit",
      shell: true,
    });

    await waitForServer("http://127.0.0.1:3012/login");

    console.log("Running Evaluation Queries...");
    const outputFilePath = path.join(process.cwd(), "docs", "somni_rag_evaluation.csv");
    let csvContent = "id,group,age_band,sleep_style,question,somni_response,chatgpt_response,personalisation,actionability,sleep_specific_usefulness,trust_grounding,tone,safety_boundaries,conciseness,total_score,gap_analysis,corpus_refinement\n";
    
    // Check for existing progress to resume
    let existingIds = new Set();
    try {
      const existingFile = await readFile(outputFilePath, "utf8");
      const lines = existingFile.split("\n");
      for (const line of lines) {
         if (line.trim() && !line.startsWith("id,")) {
            const idMatch = line.match(/^(\d+),/);
            if (idMatch && idMatch[1]) existingIds.add(parseInt(idMatch[1], 10));
         }
      }
      if (existingIds.size > 0) {
        console.log(`Found ${existingIds.size} existing evaluations. Resuming from where we left off...`);
      } else {
        await writeFile(outputFilePath, csvContent, "utf8");
      }
    } catch {
      await writeFile(outputFilePath, csvContent, "utf8");
    }

    for (const tc of testCases) {
      if (existingIds.has(tc.id)) {
         console.log(`Skipping [${tc.id}/50] - Already evaluated.`);
         continue;
      }
      
      console.log(`Processing [${tc.id}/50]: ${tc.question.substring(0, 40)}...`);

      // Update baby and onboarding settings for THIS test case
      await supabaseAdmin.from("babies").delete().eq("profile_id", createdUserId);
      const { data: babyData } = await supabaseAdmin.from("babies").insert({
        profile_id: createdUserId,
        name: "EvalBaby",
        date_of_birth: tc.age_band === "0-3 months" ? new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() :
                       tc.age_band === "4-6 months" ? new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString() :
                       tc.age_band === "6-12 months" ? new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString() :
                       new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      }).select("id").single();

      await supabaseAdmin.from("onboarding_preferences").insert({
        baby_id: babyData.id,
        sleep_style_label: tc.sleep_style_label,
        question_1_score: 5, question_2_score: 5, question_3_score: 5, question_4_score: 5, question_5_score: 5, sleep_style_score: 5
      });

      // Erase chat history for fresh context
      await supabaseAdmin.from("messages").delete().eq("profile_id", createdUserId);

      const response = await fetch("http://127.0.0.1:3012/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader, "x-eval-mode": "true" },
        body: JSON.stringify({ message: tc.question }),
      });

      let somniResponse = "";
      if (!response.ok) {
         somniResponse = `ERROR HTTP ${response.status}: ` + (await response.text()).substring(0, 100);
         throw new Error(`Failed to generate response for [${tc.id}/50]: ${somniResponse}`);
      } else {
         somniResponse = await readSseResponseText(response);
         if (somniResponse.startsWith("ERROR:")) {
            throw new Error(`Failed to stream response for [${tc.id}/50]: ${somniResponse}`);
         }
      }
      
      const line = `${tc.id},"${tc.group}",${tc.age_band},${tc.sleep_style_label},"${tc.question.replace(/"/g, '""')}",${somniResponse},"","","","","","","","","","",""\n`;
      await writeFile(outputFilePath, line, { flag: "a", encoding: "utf8" });
      
      if (tc.id === 1 && !existingIds.has(1)) {
         console.log(`\n--- PAUSED ---`);
         console.log(`Row 1 has been generated. Please open 'docs/somni_rag_evaluation.csv', check that it looks correct, and doesn't contain formatting errors.`);
         const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
         await new Promise(resolve => rl.question("Press ENTER to continue with the remaining 49 questions, or Ctrl+C to abort...", resolve));
         rl.close();
      }

      // Strict 61-second wait for 2.5-flash safe API limits
      console.log(`Successfully recorded [${tc.id}/50]. Waiting 61 seconds for API quota cooldown...`);
      await sleep(61000);
    }
    console.log(`\nEvaluation complete! CSV written to: ${outputFilePath}`);
    console.log("Next steps: Open this CSV, fill in the 'chatgpt_response' column, then run the LLM Judge script.");

  } finally {
    if (serverProcess) serverProcess.kill("SIGTERM");
    if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
