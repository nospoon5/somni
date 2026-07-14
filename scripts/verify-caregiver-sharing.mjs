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
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function run() {
  await loadDotEnvLocal();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration in .env.local");
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Stage 3 Caregiver Sharing validation starting...");

  const ownerEmail = `owner-${Date.now()}@test.com`;
  const caregiverEmail = `caregiver-${Date.now()}@test.com`;
  const password = "TestPassword123!";

  console.log(`Creating test owner: ${ownerEmail}`);
  const { data: ownerUser, error: ownerCreateError } = await adminClient.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
  });
  if (ownerCreateError) throw ownerCreateError;

  console.log(`Creating test caregiver: ${caregiverEmail}`);
  const { data: caregiverUser, error: caregiverCreateError } = await adminClient.auth.admin.createUser({
    email: caregiverEmail,
    password,
    email_confirm: true,
  });
  if (caregiverCreateError) throw caregiverCreateError;

  await adminClient.from('profiles').upsert({ id: ownerUser.user.id, email: ownerEmail, onboarding_completed: true });
  await adminClient.from('profiles').upsert({ id: caregiverUser.user.id, email: caregiverEmail, onboarding_completed: false });

  const ownerClient = createClient(supabaseUrl, supabaseAnonKey);
  const { error: ownerLoginError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password });
  if (ownerLoginError) throw ownerLoginError;

  const caregiverClient = createClient(supabaseUrl, supabaseAnonKey);
  const { error: caregiverLoginError } = await caregiverClient.auth.signInWithPassword({ email: caregiverEmail, password });
  if (caregiverLoginError) throw caregiverLoginError;

  console.log("Successfully logged in both clients.");

  const { data: { user: currentUser } } = await ownerClient.auth.getUser();
  console.log(`Current logged in owner client user ID: ${currentUser?.id}, expected: ${ownerUser.user.id}`);

  console.log("Owner inserting a baby profile...");
  const { data: baby, error: babyError } = await ownerClient
    .from('babies')
    .insert({
      profile_id: ownerUser.user.id,
      name: "Test Baby",
      date_of_birth: "2026-01-01",
      feeding_type: "breast",
    })
    .select()
    .single();

  if (babyError) throw babyError;
  console.log(`Baby created with ID: ${baby.id}`);

  console.log("Verifying caregiver cannot access the baby profile...");
  const { data: caregiverBabyQuery, error: qError } = await caregiverClient
    .from('babies')
    .select('id, name')
    .eq('id', baby.id)
    .maybeSingle();

  if (qError) throw qError;
  if (caregiverBabyQuery) {
    throw new Error("Security check failed: caregiver was able to view the baby details before invitation!");
  }
  console.log("Security isolation verified successfully.");

  console.log("Owner creating baby share invitation...");
  const { data: share, error: shareError } = await ownerClient
    .from('baby_shares')
    .insert({
      baby_id: baby.id,
      email: caregiverEmail,
      access_role: 'caregiver',
      status: 'pending',
    })
    .select()
    .single();

  if (shareError) throw shareError;
  console.log(`Invitation created with ID: ${share.id}`);

  console.log("Caregiver accepting invitation...");
  const { error: acceptError } = await caregiverClient
    .from('baby_shares')
    .update({
      status: 'accepted',
      profile_id: caregiverUser.user.id,
    })
    .eq('id', share.id);

  if (acceptError) throw acceptError;
  console.log("Invitation accepted.");

  console.log("Verifying caregiver can now view the baby details...");
  const { data: caregiverBabyQueryAfter, error: qErrorAfter } = await caregiverClient
    .from('babies')
    .select('id, name')
    .eq('id', baby.id)
    .maybeSingle();

  if (qErrorAfter) throw qErrorAfter;
  if (!caregiverBabyQueryAfter) {
    throw new Error("Verification failed: Caregiver still cannot access the baby profile after accepting invitation.");
  }
  console.log(`Verified! Caregiver can read baby: ${caregiverBabyQueryAfter.name}`);

  console.log("Verifying caregiver can insert a sleep log for the baby...");
  const { data: sleepLog, error: logError } = await caregiverClient
    .from('sleep_logs')
    .insert({
      baby_id: baby.id,
      started_at: new Date().toISOString(),
      is_night: false,
    })
    .select()
    .single();

  if (logError) throw logError;
  console.log(`Verified! Caregiver successfully inserted sleep log: ${sleepLog.id}`);

  console.log("Cleaning up test users and data...");
  const { error: delOwnerError } = await adminClient.auth.admin.deleteUser(ownerUser.user.id);
  if (delOwnerError) console.error("Failed to delete owner user:", delOwnerError);
  
  const { error: delCaregiverError } = await adminClient.auth.admin.deleteUser(caregiverUser.user.id);
  if (delCaregiverError) console.error("Failed to delete caregiver user:", delCaregiverError);

  console.log("All validation tests passed successfully!");
}

run().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
