-- Add browser push subscriptions, notification preferences, and in-app feed logs.

ALTER TABLE public.profiles
  ADD COLUMN push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN in_app_feed_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN night_suppression_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN suppression_start TEXT NOT NULL DEFAULT '19:00',
  ADD COLUMN suppression_end TEXT NOT NULL DEFAULT '06:00',
  ADD CONSTRAINT profiles_suppression_start_format_check
    CHECK (suppression_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT profiles_suppression_end_format_check
    CHECK (suppression_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Profile updates use a column allow-list so users cannot change protected
-- fields such as is_admin. Add only the notification preferences to that list;
-- the existing owner-only RLS policy continues to restrict whose row is edited.
GRANT UPDATE (
  push_enabled,
  in_app_feed_enabled,
  night_suppression_enabled,
  suppression_start,
  suppression_end
) ON TABLE public.profiles TO authenticated;

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX push_subscriptions_profile_id_idx
  ON public.push_subscriptions(profile_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions FROM anon;
REVOKE ALL ON TABLE public.push_subscriptions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.push_subscriptions
  TO authenticated;

CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can insert their own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX notification_logs_profile_created_at_idx
  ON public.notification_logs(profile_id, created_at DESC);

CREATE INDEX notification_logs_profile_unread_idx
  ON public.notification_logs(profile_id, created_at DESC)
  WHERE is_read = FALSE;

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_logs FROM anon;
REVOKE ALL ON TABLE public.notification_logs FROM authenticated;
GRANT SELECT ON TABLE public.notification_logs TO authenticated;
GRANT UPDATE (is_read) ON TABLE public.notification_logs TO authenticated;

CREATE POLICY "Users can view their own notification logs"
  ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can update their own notification logs"
  ON public.notification_logs
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);
