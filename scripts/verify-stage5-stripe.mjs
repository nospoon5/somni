#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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

async function fetchWithTimeout(url, init = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetchWithTimeout(url, {}, 5000);
      if (response.ok || response.status === 200) {
        return;
      }
    } catch {
      // Keep polling.
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
  const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  const monthlyPriceId = requireEnv("STRIPE_PRICE_MONTHLY");

  const stripe = new Stripe(stripeSecretKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const supabaseAuth = createClient(supabaseUrl, anonKey);

  const email = `stage5-stripe-${Date.now()}@somni.test`;
  const password = `SomniStripe!${Math.floor(Math.random() * 100000)}`;
  let createdUserId = null;
  let stripeCustomerId = null;
  let serverProcess = null;
  let serverLog = "";

  try {
    console.log("Step 1: Creating temporary Stripe verification user...");
    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Stage5 Stripe" },
    });

    if (createUserError) {
      throw new Error(`Failed to create e2e user: ${createUserError.message}`);
    }

    createdUserId = createdUser.user?.id ?? null;
    if (!createdUserId) {
      throw new Error("Failed to create e2e user id");
    }

    await waitForProfile(supabaseAdmin, createdUserId);

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

    console.log("Step 2: Starting local app server on port 3014...");
    serverProcess = spawn("npm", ["run", "start"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3014" },
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
      await waitForServer("http://127.0.0.1:3014/login", 45000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server readiness check failed";
      throw new Error(`${message}\n\nServer output:\n${serverLog}`);
    }

    console.log("Step 3: Verifying checkout session creation...");
    const checkoutResponse = await fetchWithTimeout("http://127.0.0.1:3014/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ plan: "monthly" }),
    });

    if (!checkoutResponse.ok) {
      const payload = await checkoutResponse.json().catch(() => null);
      throw new Error(`Checkout route failed (${checkoutResponse.status}): ${JSON.stringify(payload)}`);
    }

    const checkoutPayload = await checkoutResponse.json();
    if (typeof checkoutPayload.url !== "string" || !checkoutPayload.url.includes("stripe.com")) {
      throw new Error("Checkout route did not return a Stripe URL");
    }

    const { data: checkoutSubscription, error: checkoutSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, plan, status")
      .eq("profile_id", createdUserId)
      .single();

    if (checkoutSubscriptionError) {
      throw new Error(`Failed to inspect checkout subscription row: ${checkoutSubscriptionError.message}`);
    }

    stripeCustomerId = checkoutSubscription.stripe_customer_id;
    if (!stripeCustomerId) {
      throw new Error("Checkout did not persist a Stripe customer id");
    }

    console.log("Step 4: Verifying billing portal session creation...");
    const { error: activateError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan: "monthly",
        status: "active",
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("profile_id", createdUserId);

    if (activateError) {
      throw new Error(`Failed to seed active subscription state: ${activateError.message}`);
    }

    const portalResponse = await fetchWithTimeout("http://127.0.0.1:3014/api/billing/portal", {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!portalResponse.ok) {
      const payload = await portalResponse.json().catch(() => null);
      throw new Error(`Portal route failed (${portalResponse.status}): ${JSON.stringify(payload)}`);
    }

    const portalPayload = await portalResponse.json();
    if (typeof portalPayload.url !== "string" || !portalPayload.url.includes("billing.stripe.com")) {
      throw new Error("Portal route did not return a Stripe billing portal URL");
    }

    console.log("Step 5: Verifying webhook subscription sync...");
    const periodEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
    const fakeSubscriptionId = `sub_stage5_${Date.now()}`;
    const webhookEvent = {
      id: `evt_stage5_${Date.now()}`,
      object: "event",
      type: "customer.subscription.updated",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: fakeSubscriptionId,
          object: "subscription",
          customer: stripeCustomerId,
          status: "active",
          metadata: {
            profile_id: createdUserId,
          },
          trial_end: null,
          items: {
            object: "list",
            data: [
              {
                id: `si_stage5_${Date.now()}`,
                object: "subscription_item",
                current_period_end: periodEnd,
                price: {
                  id: monthlyPriceId,
                  object: "price",
                  recurring: {
                    interval: "month",
                  },
                },
              },
            ],
          },
        },
      },
    };

    const webhookBody = JSON.stringify(webhookEvent);
    const stripeSignature = stripe.webhooks.generateTestHeaderString({
      payload: webhookBody,
      secret: webhookSecret,
    });

    const webhookResponse = await fetchWithTimeout("http://127.0.0.1:3014/api/billing/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": stripeSignature,
      },
      body: webhookBody,
    });

    if (!webhookResponse.ok) {
      const payload = await webhookResponse.json().catch(() => null);
      throw new Error(
        `Webhook route failed (${webhookResponse.status}): ${JSON.stringify(payload)}`
      );
    }

    const { data: syncedSubscription, error: syncedSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, plan, status, current_period_end")
      .eq("profile_id", createdUserId)
      .single();

    if (syncedSubscriptionError) {
      throw new Error(`Failed to inspect synced subscription row: ${syncedSubscriptionError.message}`);
    }

    if (syncedSubscription.stripe_subscription_id !== fakeSubscriptionId) {
      throw new Error("Webhook did not persist the Stripe subscription id");
    }
    if (syncedSubscription.plan !== "monthly" || syncedSubscription.status !== "active") {
      throw new Error("Webhook did not sync monthly active subscription state");
    }

    console.log("Stage 5 Stripe verification passed:");
    console.log("- Checkout route returns a Stripe Checkout URL");
    console.log("- Portal route returns a Stripe billing portal URL");
    console.log("- Webhook route updates the stored subscription state");
  } finally {
    console.log("Final step: Cleaning up Stripe verification resources...");
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }

    if (stripeCustomerId) {
      await stripe.customers.del(stripeCustomerId).catch(() => {});
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
