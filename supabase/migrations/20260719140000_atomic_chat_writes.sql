-- supabase/migrations/20260719140000_atomic_chat_writes.sql
-- Atomically writes a chat message, sleep logs, daily plans, and sleep plan profiles.
-- The function is NOT Security Definer so it runs with the caller's RLS policies.

CREATE OR REPLACE FUNCTION atomic_chat_interaction(
  p_message jsonb DEFAULT NULL,
  p_sleep_log jsonb DEFAULT NULL,
  p_profile_update jsonb DEFAULT NULL,
  p_daily_plan_upsert jsonb DEFAULT NULL,
  p_change_events jsonb DEFAULT '[]'::jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Insert message
  IF p_message IS NOT NULL THEN
    INSERT INTO messages (
      profile_id, baby_id, conversation_id, role, content, sources_used,
      safety_note, is_emergency_redirect, confidence, model
    )
    SELECT
      (p_message->>'profile_id')::uuid,
      (p_message->>'baby_id')::uuid,
      (p_message->>'conversation_id')::uuid,
      p_message->>'role',
      p_message->>'content',
      COALESCE(p_message->'sources_used', '[]'::jsonb),
      p_message->>'safety_note',
      COALESCE((p_message->>'is_emergency_redirect')::boolean, false),
      p_message->>'confidence',
      p_message->>'model';
  END IF;

  -- 2. Insert sleep log
  IF p_sleep_log IS NOT NULL THEN
    INSERT INTO sleep_logs (
      baby_id, started_at, ended_at, is_night, notes, tags, logged_by
    )
    SELECT
      (p_sleep_log->>'baby_id')::uuid,
      (p_sleep_log->>'started_at')::timestamptz,
      (p_sleep_log->>'ended_at')::timestamptz,
      COALESCE((p_sleep_log->>'is_night')::boolean, false),
      p_sleep_log->>'notes',
      COALESCE(p_sleep_log->'tags', '[]'::jsonb),
      (p_sleep_log->>'logged_by')::uuid
    ON CONFLICT (baby_id, started_at, ended_at) WHERE ended_at IS NOT NULL
    DO NOTHING;
  END IF;

  -- 3. Update profile
  IF p_profile_update IS NOT NULL THEN
    UPDATE sleep_plan_profiles SET
      usual_wake_time = p_profile_update->>'usual_wake_time',
      target_bedtime = p_profile_update->>'target_bedtime',
      target_nap_count = (p_profile_update->>'target_nap_count')::int,
      wake_window_profile = p_profile_update->'wake_window_profile',
      feed_anchor_profile = p_profile_update->'feed_anchor_profile',
      schedule_preference = p_profile_update->>'schedule_preference',
      day_structure = p_profile_update->'day_structure',
      adaptation_confidence = p_profile_update->>'adaptation_confidence',
      learning_state = p_profile_update->'learning_state',
      last_evidence_summary = p_profile_update->>'last_evidence_summary',
      updated_at = COALESCE((p_profile_update->>'updated_at')::timestamptz, now())
    WHERE id = (p_profile_update->>'id')::uuid
      AND baby_id = (p_profile_update->>'baby_id')::uuid;
  END IF;

  -- 4. Upsert daily plan
  IF p_daily_plan_upsert IS NOT NULL THEN
    INSERT INTO daily_plans (
      baby_id, plan_date, sleep_targets, feed_targets, notes,
      pending_rescue_targets, rescue_dismissed, updated_at
    )
    SELECT
      (p_daily_plan_upsert->>'baby_id')::uuid,
      (p_daily_plan_upsert->>'plan_date')::date,
      COALESCE(p_daily_plan_upsert->'sleep_targets', '[]'::jsonb),
      COALESCE(p_daily_plan_upsert->'feed_targets', '[]'::jsonb),
      p_daily_plan_upsert->>'notes',
      p_daily_plan_upsert->'pending_rescue_targets',
      COALESCE((p_daily_plan_upsert->>'rescue_dismissed')::boolean, false),
      COALESCE((p_daily_plan_upsert->>'updated_at')::timestamptz, now())
    ON CONFLICT (baby_id, plan_date)
    DO UPDATE SET
      sleep_targets = EXCLUDED.sleep_targets,
      feed_targets = EXCLUDED.feed_targets,
      notes = EXCLUDED.notes,
      pending_rescue_targets = COALESCE(EXCLUDED.pending_rescue_targets, daily_plans.pending_rescue_targets),
      rescue_dismissed = COALESCE(EXCLUDED.rescue_dismissed, daily_plans.rescue_dismissed),
      updated_at = EXCLUDED.updated_at;
  END IF;

  -- 5. Insert change events
  IF jsonb_array_length(p_change_events) > 0 THEN
    INSERT INTO sleep_plan_change_events (
      baby_id, sleep_plan_profile_id, plan_date, change_scope, change_source,
      change_kind, evidence_confidence, summary, rationale,
      before_snapshot, after_snapshot
    )
    SELECT
      (event->>'baby_id')::uuid,
      (event->>'sleep_plan_profile_id')::uuid,
      (event->>'plan_date')::date,
      event->>'change_scope',
      event->>'change_source',
      event->>'change_kind',
      event->>'evidence_confidence',
      event->>'summary',
      event->>'rationale',
      event->'before_snapshot',
      event->'after_snapshot'
    FROM jsonb_array_elements(p_change_events) AS event;
  END IF;

END;
$$;
