#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

async function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

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

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function urlFor(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting for the dev server to become ready.
    }

    await sleep(1000);
  }

  throw new Error(`Dev server did not become ready within ${timeoutMs}ms: ${url}`);
}

function decodeHtml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function extractHiddenInputs(html) {
  return [...html.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g)].map(
    (match) => [match[1], decodeHtml(match[2] ?? "")]
  );
}

function createFormData(hiddenInputs, fieldValues = {}) {
  const formData = new FormData();

  for (const [name, value] of hiddenInputs) {
    formData.append(name, value);
  }

  for (const [name, value] of Object.entries(fieldValues)) {
    formData.set(name, value);
  }

  return formData;
}

function splitSetCookieHeader(headerValue) {
  return headerValue.split(/, (?=[^;]+?=)/g);
}

function applySetCookies(response, cookieJar) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookieHeader(response.headers.get("set-cookie") ?? "");

  for (const header of values) {
    if (!header) {
      continue;
    }

    const firstPart = header.split(";", 1)[0];
    const separator = firstPart.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = firstPart.slice(0, separator);
    const value = firstPart.slice(separator + 1);

    if (!value) {
      cookieJar.delete(name);
      continue;
    }

    cookieJar.set(name, value);
  }
}

function getCookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function getAuthCookieValue(cookieJar) {
  const match = [...cookieJar.entries()].find(
    ([name]) => name.startsWith("sb-") && name.endsWith("-auth-token")
  );

  if (!match) {
    throw new Error("Signup did not return the Supabase auth cookie.");
  }

  return match[1];
}

function getUserIdFromAuthCookie(cookieValue) {
  if (!cookieValue.startsWith("base64-")) {
    throw new Error("Supabase auth cookie had an unexpected format.");
  }

  const decoded = Buffer.from(cookieValue.slice("base64-".length), "base64").toString("utf8");
  const session = JSON.parse(decoded);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Could not read the temporary user id from the auth cookie.");
  }

  return userId;
}

function getInlineError(body) {
  const patterns = [
    /"error":"([^"]+)"/,
    /error&quot;:&quot;([^"]+)&quot;/,
    /<p[^>]*>(Please[^<]+)<\/p>/,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

async function expectRedirect(response, expectedPath, stepName) {
  const location = response.headers.get("location");
  if (response.status === 303 && location === expectedPath) {
    return;
  }

  const body = await response.text();
  const inlineError = getInlineError(body);
  throw new Error(
    `${stepName} expected a 303 redirect to ${expectedPath}, received status ${response.status}${
      location ? ` and location ${location}` : ""
    }${inlineError ? ` (${inlineError})` : ""}`
  );
}

async function main() {
  await loadDotEnvLocal();

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const appUrl = normalizeBaseUrl(process.env.SOMNI_APP_URL ?? "http://127.0.0.1:3000");
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const email = `phase6-onboarding-${Date.now()}@somni.test`;
  const password = `SomniOnboarding!${Math.floor(Math.random() * 100000)}`;
  const fullName = "Phase 6 Smoke";
  const cookieJar = new Map();
  let createdUserId = null;

  try {
    console.log(`Step 1: Waiting for the running dev server at ${appUrl}...`);
    await waitForServer(urlFor(appUrl, "/signup"));

    console.log("Step 2: Loading the live signup form...");
    const signupPageResponse = await fetch(urlFor(appUrl, "/signup"));
    const signupPageHtml = await signupPageResponse.text();
    const signupForm = createFormData(extractHiddenInputs(signupPageHtml), {
      fullName,
      email,
      password,
    });

    console.log("Step 3: Creating a fresh temporary account through /signup...");
    const signupResponse = await fetch(urlFor(appUrl, "/signup"), {
      method: "POST",
      headers: {
        Origin: appUrl,
        Referer: urlFor(appUrl, "/signup"),
      },
      body: signupForm,
      redirect: "manual",
    });

    await expectRedirect(signupResponse, "/onboarding", "Signup");
    applySetCookies(signupResponse, cookieJar);
    createdUserId = getUserIdFromAuthCookie(getAuthCookieValue(cookieJar));

    console.log("Step 4: Loading the onboarding form with the authenticated session...");
    const onboardingPageResponse = await fetch(urlFor(appUrl, "/onboarding"), {
      headers: {
        Cookie: getCookieHeader(cookieJar),
      },
    });
    const onboardingPageHtml = await onboardingPageResponse.text();

    if (
      !onboardingPageResponse.ok ||
      !onboardingPageHtml.includes('name="babyName"') ||
      !onboardingPageHtml.includes('name="question1"')
    ) {
      throw new Error("Onboarding page did not load for the newly created user.");
    }

    const onboardingForm = createFormData(extractHiddenInputs(onboardingPageHtml), {
      babyName: "Phase Baby",
      dateOfBirth: "2025-12-01",
      biggestIssue: "night_waking",
      feedingType: "mixed",
      bedtimeRange: "7-8pm",
      typicalWakeTime: "06:30",
      dayStructure: "mostly_home_flexible",
      napPattern: "mostly_3_naps",
      nightFeeds: "yes",
      schedulePreference: "mix_of_cues_and_anchors",
      question1: "6",
      question2: "6",
      question3: "6",
      question4: "6",
      question5: "6",
    });

    console.log("Step 5: Completing onboarding through /onboarding...");
    const finishOnboardingResponse = await fetch(urlFor(appUrl, "/onboarding"), {
      method: "POST",
      headers: {
        Cookie: getCookieHeader(cookieJar),
        Origin: appUrl,
        Referer: urlFor(appUrl, "/onboarding"),
      },
      body: onboardingForm,
      redirect: "manual",
    });

    await expectRedirect(finishOnboardingResponse, "/dashboard", "Onboarding");
    applySetCookies(finishOnboardingResponse, cookieJar);

    console.log("Step 6: Verifying the dashboard loads without redirecting back to onboarding...");
    const dashboardResponse = await fetch(urlFor(appUrl, "/dashboard"), {
      headers: {
        Cookie: getCookieHeader(cookieJar),
      },
      redirect: "manual",
    });
    const dashboardHtml = await dashboardResponse.text();

    if (!dashboardResponse.ok) {
      throw new Error(`Dashboard returned ${dashboardResponse.status} for the newly onboarded user.`);
    }

    if (!dashboardHtml.includes("Dashboard")) {
      throw new Error("Dashboard page did not render expected dashboard content.");
    }

    console.log("Step 7: Verifying the onboarding records were saved...");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, onboarding_completed")
      .eq("id", createdUserId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to verify the profile row: ${profileError.message}`);
    }
    if (!profile?.onboarding_completed) {
      throw new Error("Profile row was not marked as onboarding_completed.");
    }

    const { data: baby, error: babyError } = await supabaseAdmin
      .from("babies")
      .select("id, name, profile_id")
      .eq("profile_id", createdUserId)
      .maybeSingle();

    if (babyError) {
      throw new Error(`Failed to verify the baby row: ${babyError.message}`);
    }
    if (!baby?.id || baby.name !== "Phase Baby") {
      throw new Error("Expected the onboarding flow to create the baby row.");
    }

    const { data: preferences, error: preferencesError } = await supabaseAdmin
      .from("onboarding_preferences")
      .select("sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference")
      .eq("baby_id", baby.id)
      .maybeSingle();

    if (preferencesError) {
      throw new Error(`Failed to verify onboarding_preferences: ${preferencesError.message}`);
    }

    if (!preferences) {
      throw new Error("Expected the onboarding flow to create onboarding_preferences.");
    }

    if (
      preferences.sleep_style_label !== "balanced" ||
      preferences.day_structure !== "mostly_home_flexible" ||
      preferences.nap_pattern !== "mostly_3_naps" ||
      preferences.night_feeds !== true ||
      preferences.schedule_preference !== "mix_of_cues_and_anchors"
    ) {
      throw new Error("Onboarding preferences were saved, but the core values were not what the smoke test submitted.");
    }

    console.log("Onboarding smoke verification passed:");
    console.log("- Fresh account creation through /signup succeeded");
    console.log("- Authenticated onboarding submission redirected to /dashboard");
    console.log("- /dashboard loaded for the newly onboarded user");
    console.log("- Profile, baby, and onboarding preference rows were persisted");
  } finally {
    console.log("Final step: Cleaning up the temporary smoke-test account...");

    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
