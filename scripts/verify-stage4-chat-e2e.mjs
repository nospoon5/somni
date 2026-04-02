#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

async function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf8");
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

async function readSseResponse(response) {
  if (!response.body) {
    throw new Error("Missing response body for SSE");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamedText = "";
  let donePayload = null;
  let errorPayload = null;

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
        donePayload = parsed.payload;
      }
      if (parsed.event === "error") {
        errorPayload = parsed.payload;
      }
    }
  }

  return { streamedText, donePayload, errorPayload };
}

async function waitForProfile(supabaseAdmin, userId, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (data?.id) {
      return;
    }
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

  const email = `stage4-e2e-${Date.now()}@somni.test`;
  const password = `SomniE2E!${Math.floor(Math.random() * 100000)}`;
  let createdUserId = null;
  let serverProcess = null;

  try {
    console.log("Step 1: Creating temporary test user...");
    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Stage4 E2E" },
    });

    if (createUserError) {
      throw new Error(`Failed to create e2e user: ${createUserError.message}`);
    }

    createdUserId = createdUser.user?.id ?? null;
    if (!createdUserId) {
      throw new Error("Failed to create e2e user id");
    }

    await waitForProfile(supabaseAdmin, createdUserId);
    console.log("Step 2: Seeding baby + onboarding data...");

    const { data: babyData, error: babyError } = await supabaseAdmin
      .from("babies")
      .insert({
        profile_id: createdUserId,
        name: "E2E Baby",
        date_of_birth: "2025-11-01",
        biggest_issue: "frequent night waking",
        feeding_type: "mixed",
        bedtime_range: "7:00-8:00 pm",
      })
      .select("id")
      .single();

    if (babyError) {
      throw new Error(`Failed to create baby row: ${babyError.message}`);
    }

    const { error: onboardingError } = await supabaseAdmin
      .from("onboarding_preferences")
      .insert({
        baby_id: babyData.id,
        question_1_score: 6,
        question_2_score: 6,
        question_3_score: 6,
        question_4_score: 6,
        question_5_score: 6,
        sleep_style_score: 6,
        sleep_style_label: "balanced",
      });

    if (onboardingError) {
      throw new Error(`Failed to create onboarding row: ${onboardingError.message}`);
    }

    const { error: onboardingFlagError } = await supabaseAdmin
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", createdUserId);

    if (onboardingFlagError) {
      throw new Error(`Failed to update onboarding flag: ${onboardingFlagError.message}`);
    }

    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      throw new Error(`Failed to sign in e2e user: ${signInError?.message ?? "unknown error"}`);
    }

    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = `base64-${base64url(JSON.stringify(signInData.session))}`;
    const cookieHeader = `${cookieName}=${cookieValue}`;
    console.log("Step 3: Starting local app server on port 3011...");

    serverProcess = spawn("npm", ["run", "start"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3011" },
      stdio: "pipe",
      shell: true,
    });

    await sleep(5000);
    console.log("Step 4: Calling normal chat endpoint...");

    const normalController = new AbortController();
    const normalTimeout = setTimeout(() => normalController.abort(), 120000);
    const normalResponse = await fetch("http://127.0.0.1:3011/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        message: "My 5 month old has short naps and multiple night wakes. What should we try tonight?",
      }),
      signal: normalController.signal,
    });
    clearTimeout(normalTimeout);

    if (!normalResponse.ok) {
      throw new Error(`Normal chat call failed (${normalResponse.status})`);
    }

    const normalResult = await readSseResponse(normalResponse);
    console.log("Step 5: Verifying persisted rows...");
    if (normalResult.errorPayload) {
      throw new Error(`Normal chat SSE error: ${JSON.stringify(normalResult.errorPayload)}`);
    }
    if (!normalResult.donePayload?.conversation_id) {
      throw new Error("Normal chat response did not include a conversation_id");
    }
    if (!normalResult.streamedText.trim() && !normalResult.donePayload?.message) {
      throw new Error("Normal chat response did not stream message content");
    }
    if (!Array.isArray(normalResult.donePayload?.sources) || normalResult.donePayload.sources.length === 0) {
      throw new Error("Normal chat response did not include source attribution");
    }

    const conversationId = normalResult.donePayload.conversation_id;

    const { data: persistedRows, error: persistedError } = await supabaseAdmin
      .from("messages")
      .select("role, content, sources_used, safety_note, is_emergency_redirect")
      .eq("profile_id", createdUserId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (persistedError) {
      throw new Error(`Failed to verify persisted messages: ${persistedError.message}`);
    }

    if (!persistedRows || persistedRows.length < 2) {
      throw new Error("Expected persisted user+assistant rows for normal chat");
    }
    const assistantRow = persistedRows.find((row) => row.role === "assistant");
    if (!assistantRow?.sources_used) {
      throw new Error("Assistant row did not persist sources_used");
    }

    console.log("Step 6: Calling emergency chat endpoint...");
    const emergencyController = new AbortController();
    const emergencyTimeout = setTimeout(() => emergencyController.abort(), 120000);
    const emergencyResponse = await fetch("http://127.0.0.1:3011/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        message: "My baby is not breathing and turning blue what do I do",
      }),
      signal: emergencyController.signal,
    });
    clearTimeout(emergencyTimeout);

    if (!emergencyResponse.ok) {
      throw new Error(`Emergency chat call failed (${emergencyResponse.status})`);
    }

    const emergencyResult = await readSseResponse(emergencyResponse);
    if (!emergencyResult.donePayload?.is_emergency_redirect) {
      throw new Error("Emergency prompt did not trigger emergency redirect response");
    }
    if (!emergencyResult.donePayload?.safety_note) {
      throw new Error("Emergency prompt did not include safety note");
    }

    console.log("Stage 4 chat e2e verification passed:");
    console.log("- Authenticated streaming response succeeded");
    console.log("- Messages persisted for normal conversation");
    console.log("- Emergency redirect behavior succeeded");
  } finally {
    console.log("Final step: Cleaning up test resources...");
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }

    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
