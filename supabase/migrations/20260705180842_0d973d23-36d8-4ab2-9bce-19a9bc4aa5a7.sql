
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_freezes_available integer NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS public.streak_freezes_used (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  freeze_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, freeze_date)
);

GRANT SELECT, INSERT, DELETE ON public.streak_freezes_used TO authenticated;
GRANT ALL ON public.streak_freezes_used TO service_role;

ALTER TABLE public.streak_freezes_used ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own freeze uses"
  ON public.streak_freezes_used FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own freeze uses"
  ON public.streak_freezes_used FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own freeze uses"
  ON public.streak_freezes_used FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS streak_freezes_used_user_group_idx
  ON public.streak_freezes_used (user_id, group_id, freeze_date);
