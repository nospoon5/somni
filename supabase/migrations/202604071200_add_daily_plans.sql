CREATE TABLE public.daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  sleep_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
  feed_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT daily_plans_one_plan_per_baby_per_day UNIQUE (baby_id, plan_date),
  CONSTRAINT daily_plans_sleep_targets_array CHECK (jsonb_typeof(sleep_targets) = 'array'),
  CONSTRAINT daily_plans_feed_targets_array CHECK (jsonb_typeof(feed_targets) = 'array')
);

CREATE INDEX daily_plans_baby_plan_date_idx
  ON public.daily_plans (baby_id, plan_date DESC);

CREATE INDEX daily_plans_plan_date_idx
  ON public.daily_plans (plan_date DESC);

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily plans for their babies"
  ON public.daily_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = daily_plans.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert daily plans for their babies"
  ON public.daily_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = daily_plans.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update daily plans for their babies"
  ON public.daily_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = daily_plans.baby_id
      AND babies.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = daily_plans.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete daily plans for their babies"
  ON public.daily_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = daily_plans.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE TRIGGER set_daily_plans_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
