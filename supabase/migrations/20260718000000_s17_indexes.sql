-- Create indexes for performance on frequent query paths

-- 1. Recent sleep logs and active session lookups
CREATE INDEX IF NOT EXISTS sleep_logs_baby_time_idx ON sleep_logs (baby_id, started_at DESC);

-- 2. Daily plans lookup by baby and date
CREATE INDEX IF NOT EXISTS daily_plans_baby_date_idx ON daily_plans (baby_id, plan_date);

-- 3. Notification feed unread counts
CREATE INDEX IF NOT EXISTS notification_logs_profile_read_idx ON notification_logs (profile_id, is_read);
