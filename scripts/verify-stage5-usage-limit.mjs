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

function getUsageDate(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to compute usage date for timezone test");
  }

  return `${year}-${month}-${day}`;
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

  const email = `stage5-e2e-${Date.now()}@somni.test`;
  const password = `SomniE2E!${Math.floor(Math.random() * 100000)}`;
  const timeZone = "Australia/Sydney";
  const usageDate = getUsageDate(timeZone);
  let createdUserId = null;
  let serverProcess = null;
  let serverLog = "";

  try {
    console.log("Step 1: Creating temporary Stage 5 test user...");
    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Stage5 E2E" },
    });

    if (createUserError) {
      throw new Error(`Failed to create e2e user: ${createUserError.message}`);
    }

    createdUserId = createdUser.user?.id ?? null;
    if (!createdUserId) {
      throw new Error("Failed to create e2e user id");
    }

    await waitForProfile(supabaseAdmin, createdUserId);

    console.log("Step 2: Seeding onboarding, baby, subscription, and usage state...");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        onboarding_completed: true,
        timezone: timeZone,
      })
      .eq("id", createdUserId);

    if (profileError) {
      throw new Error(`Failed to update profile state: ${profileError.message}`);
    }

    const { data: babyData, error: babyError } = await supabaseAdmin
      .from("babies")
      .insert({
        profile_id: createdUserId,
        name: "Stage5 Baby",
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

    const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").insert({
      profile_id: createdUserId,
      plan: "free",
      status: "inactive",
    });

    if (subscriptionError) {
      throw new Error(`Failed to seed subscription state: ${subscriptionError.message}`);
    }

    const { error: usageError } = await supabaseAdmin.from("usage_counters").insert({
      profile_id: createdUserId,
      usage_date: usageDate,
      message_count: 9,
      last_incremented_at: new Date().toISOString(),
    });

    if (usageError) {
      throw new Error(`Failed to seed usage counter: ${usageError.message}`);
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

    console.log("Step 3: Starting local app server on port 3012...");
    serverProcess = spawn("npm", ["run", "start"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3012" },
      stdio: "pipe",
      shell: true,
    });

    serverProcess.stdout?.on("data", (chunk) => {
      serverLog += chunk.toString();
    });
    serverProcess.stderr?.on("data", (chunk) => {
      serverLog += chunk.toString();
    });

    try {
      await waitForServer("http://127.0.0.1:3012/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server readiness check failed";
      throw new Error(`${message}\n\nServer output:\n${serverLog}`);
    }

    console.log("Step 4: Verifying the 10th free message succeeds...");
    const successResponse = await fetch("http://127.0.0.1:3012/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        message: "My baby is not breathing and turning blue what do I do",
      }),
    });

    if (!successResponse.ok) {
      throw new Error(`Expected success call to pass, got ${successResponse.status}`);
    }

    const successResult = await readSseResponse(successResponse);
    if (successResult.errorPayload) {
      throw new Error(`Unexpected SSE error: ${JSON.stringify(successResult.errorPayload)}`);
    }
    if (!successResult.donePayload?.is_emergency_redirect) {
      throw new Error("Expected the fast emergency guardrail response for quota verification");
    }
    if (!successResult.donePayload?.message && !successResult.streamedText.trim()) {
      throw new Error("Expected a streamed assistant response for the 10th free message");
    }

    const { data: usageAfterSuccess, error: usageAfterSuccessError } = await supabaseAdmin
      .from("usage_counters")
      .select("message_count")
      .eq("profile_id", createdUserId)
      .eq("usage_date", usageDate)
      .single();

    if (usageAfterSuccessError) {
      throw new Error(`Failed to re-check usage counter: ${usageAfterSuccessError.message}`);
    }
    if (usageAfterSuccess.message_count !== 10) {
      throw new Error(`Expected usage count to be 10, got ${usageAfterSuccess.message_count}`);
    }

    console.log("Step 5: Verifying the next free message returns 429 with reset details...");
    const limitedResponse = await fetch("http://127.0.0.1:3012/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        message: "Can you give me one more plan for tonight?",
      }),
    });

    if (limitedResponse.status !== 429) {
      throw new Error(`Expected 429 after daily cap, got ${limitedResponse.status}`);
    }

    const limitedPayload = await limitedResponse.json();
    if (limitedPayload.code !== "DAILY_CHAT_LIMIT_REACHED") {
      throw new Error("Limit response did not include the expected error code");
    }
    if (!limitedPayload.resetAt || !limitedPayload.timezone) {
      throw new Error("Limit response did not include reset context");
    }

    console.log("Step 6: Promoting user to premium and verifying the cap is bypassed...");
    const { error: premiumError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan: "monthly",
        status: "active",
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_trial: false,
      })
      .eq("profile_id", createdUserId);

    if (premiumError) {
      throw new Error(`Failed to promote premium state: ${premiumError.message}`);
    }

    const premiumResponse = await fetch("http://127.0.0.1:3012/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        message: "My baby is not breathing and turning blue what do I do",
      }),
    });

    if (!premiumResponse.ok) {
      throw new Error(`Expected premium call to pass, got ${premiumResponse.status}`);
    }

    const premiumResult = await readSseResponse(premiumResponse);
    if (premiumResult.errorPayload) {
      throw new Error(`Premium SSE error: ${JSON.stringify(premiumResult.errorPayload)}`);
    }
    if (!premiumResult.donePayload?.is_emergency_redirect) {
      throw new Error("Expected the fast emergency guardrail response for premium verification");
    }

    const { data: usageAfterPremium, error: usageAfterPremiumError } = await supabaseAdmin
      .from("usage_counters")
      .select("message_count")
      .eq("profile_id", createdUserId)
      .eq("usage_date", usageDate)
      .single();

    if (usageAfterPremiumError) {
      throw new Error(`Failed to re-check premium usage counter: ${usageAfterPremiumError.message}`);
    }
    if (usageAfterPremium.message_count !== 10) {
      throw new Error(
        `Expected premium message not to increment free-tier usage, got ${usageAfterPremium.message_count}`
      );
    }

    console.log("Stage 5 usage-limit verification passed:");
    console.log("- The 10th free message succeeds");
    console.log("- The 11th free message returns 429 with reset context");
    console.log("- Premium access bypasses the free-tier cap using stored subscription state");
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
