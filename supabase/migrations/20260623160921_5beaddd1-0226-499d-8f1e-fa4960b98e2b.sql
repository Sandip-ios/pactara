
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE public.daily_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  morning_ritual_text TEXT,
  morning_ritual_posted_at TIMESTAMPTZ,
  morning_missed BOOLEAN NOT NULL DEFAULT false,
  check_in_id UUID REFERENCES public.check_ins(id) ON DELETE SET NULL,
  check_in_missed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, local_date)
);

CREATE INDEX daily_posts_group_date_idx ON public.daily_posts (group_id, local_date DESC);
CREATE INDEX daily_posts_user_date_idx ON public.daily_posts (user_id, local_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_posts TO authenticated;
GRANT ALL ON public.daily_posts TO service_role;

ALTER TABLE public.daily_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view daily posts in their groups"
  ON public.daily_posts FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users create their own daily posts in their groups"
  ON public.daily_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users update their own daily posts"
  ON public.daily_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own daily posts"
  ON public.daily_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER daily_posts_touch_updated_at
  BEFORE UPDATE ON public.daily_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
