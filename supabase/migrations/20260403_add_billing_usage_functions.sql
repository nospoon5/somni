-- Stage 5 helpers for atomic chat quota enforcement.

CREATE OR REPLACE FUNCTION public.consume_chat_quota(
  p_profile_id UUID,
  p_timezone TEXT,
  p_daily_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  allowed BOOLEAN,
  usage_date DATE,
  message_count INTEGER,
  daily_limit INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
  v_timezone TEXT := COALESCE(NULLIF(BTRIM(p_timezone), ''), 'Australia/Sydney');
  v_usage_date DATE := (now() AT TIME ZONE v_timezone)::date;
  v_reset_local TIMESTAMP := ((now() AT TIME ZONE v_timezone)::date + INTERVAL '1 day');
  v_reset_at TIMESTAMP WITH TIME ZONE := v_reset_local AT TIME ZONE v_timezone;
  v_counter public.usage_counters%ROWTYPE;
BEGIN
  INSERT INTO public.usage_counters (profile_id, usage_date, message_count, last_incremented_at)
  VALUES (p_profile_id, v_usage_date, 0, v_now)
  ON CONFLICT (profile_id, usage_date) DO NOTHING;

  SELECT *
  INTO v_counter
  FROM public.usage_counters
  WHERE profile_id = p_profile_id
    AND usage_date = v_usage_date
  FOR UPDATE;

  IF v_counter.message_count >= p_daily_limit THEN
    RETURN QUERY
    SELECT
      FALSE,
      v_usage_date,
      v_counter.message_count,
      p_daily_limit,
      GREATEST(p_daily_limit - v_counter.message_count, 0),
      v_reset_at;
    RETURN;
  END IF;

  UPDATE public.usage_counters
  SET
    message_count = v_counter.message_count + 1,
    last_incremented_at = v_now
  WHERE id = v_counter.id
  RETURNING *
  INTO v_counter;

  RETURN QUERY
  SELECT
    TRUE,
    v_usage_date,
    v_counter.message_count,
    p_daily_limit,
    GREATEST(p_daily_limit - v_counter.message_count, 0),
    v_reset_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_chat_quota(
  p_profile_id UUID,
  p_timezone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT := COALESCE(NULLIF(BTRIM(p_timezone), ''), 'Australia/Sydney');
  v_usage_date DATE := (now() AT TIME ZONE v_timezone)::date;
BEGIN
  UPDATE public.usage_counters
  SET
    message_count = GREATEST(message_count - 1, 0),
    last_incremented_at = timezone('utc'::text, now())
  WHERE profile_id = p_profile_id
    AND usage_date = v_usage_date;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_chat_quota(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_chat_quota(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_chat_quota(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_chat_quota(UUID, TEXT) TO service_role;
