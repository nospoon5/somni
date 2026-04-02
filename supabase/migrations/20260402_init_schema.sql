-- Somni V1 initial schema
-- This migration is intended to match docs/somni_architecture.md.
-- If this migration has already been applied in a live project, prefer a
-- follow-up migration instead of editing history retroactively.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Shared timestamp helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Babies
CREATE TABLE public.babies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  biggest_issue TEXT,
  feeding_type TEXT CHECK (feeding_type IN ('breast', 'bottle', 'mixed')),
  bedtime_range TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX babies_profile_id_idx ON public.babies(profile_id);

ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own babies"
  ON public.babies
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own babies"
  ON public.babies
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own babies"
  ON public.babies
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own babies"
  ON public.babies
  FOR DELETE
  USING (auth.uid() = profile_id);

-- Onboarding preferences
CREATE TABLE public.onboarding_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL UNIQUE REFERENCES public.babies(id) ON DELETE CASCADE,
  question_1_score NUMERIC(3,1) NOT NULL CHECK (question_1_score >= 1 AND question_1_score <= 10),
  question_2_score NUMERIC(3,1) NOT NULL CHECK (question_2_score >= 1 AND question_2_score <= 10),
  question_3_score NUMERIC(3,1) NOT NULL CHECK (question_3_score >= 1 AND question_3_score <= 10),
  question_4_score NUMERIC(3,1) NOT NULL CHECK (question_4_score >= 1 AND question_4_score <= 10),
  question_5_score NUMERIC(3,1) NOT NULL CHECK (question_5_score >= 1 AND question_5_score <= 10),
  sleep_style_score NUMERIC(3,1) NOT NULL CHECK (sleep_style_score >= 1 AND sleep_style_score <= 10),
  sleep_style_label TEXT NOT NULL CHECK (sleep_style_label IN ('gentle', 'balanced', 'fast-track')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.onboarding_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view onboarding preferences for their babies"
  ON public.onboarding_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = onboarding_preferences.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert onboarding preferences for their babies"
  ON public.onboarding_preferences
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = onboarding_preferences.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update onboarding preferences for their babies"
  ON public.onboarding_preferences
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = onboarding_preferences.baby_id
      AND babies.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = onboarding_preferences.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

-- Sleep logs
CREATE TABLE public.sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_night BOOLEAN NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX sleep_logs_baby_id_idx ON public.sleep_logs(baby_id);
CREATE INDEX sleep_logs_started_at_idx ON public.sleep_logs(started_at DESC);

ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sleep logs for their babies"
  ON public.sleep_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_logs.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sleep logs for their babies"
  ON public.sleep_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_logs.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sleep logs for their babies"
  ON public.sleep_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_logs.baby_id
      AND babies.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_logs.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sleep logs for their babies"
  ON public.sleep_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies
      WHERE babies.id = sleep_logs.baby_id
      AND babies.profile_id = auth.uid()
    )
  );

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources_used JSONB,
  safety_note TEXT,
  is_emergency_redirect BOOLEAN NOT NULL DEFAULT FALSE,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX messages_profile_id_idx ON public.messages(profile_id);
CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX messages_created_at_idx ON public.messages(created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON public.messages
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end TIMESTAMP WITH TIME ZONE,
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Usage counters
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  last_incremented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (profile_id, usage_date)
);

CREATE INDEX usage_counters_profile_id_idx ON public.usage_counters(profile_id);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage counters"
  ON public.usage_counters
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Corpus chunks
CREATE TABLE public.corpus_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL,
  age_band TEXT,
  methodology TEXT NOT NULL DEFAULT 'all' CHECK (methodology IN ('gentle', 'balanced', 'fast-track', 'all')),
  content TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  embedding vector(768) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.corpus_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read corpus chunks"
  ON public.corpus_chunks
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
