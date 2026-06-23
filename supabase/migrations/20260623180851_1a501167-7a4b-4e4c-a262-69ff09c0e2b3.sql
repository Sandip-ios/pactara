
CREATE TABLE public.daily_thoughts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  text text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_thoughts TO authenticated;
GRANT ALL ON public.daily_thoughts TO service_role;

ALTER TABLE public.daily_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view thoughts in their group"
  ON public.daily_thoughts FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can insert their own thoughts"
  ON public.daily_thoughts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can delete their own thoughts"
  ON public.daily_thoughts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_daily_thoughts_group_date ON public.daily_thoughts (group_id, local_date);
CREATE INDEX idx_daily_thoughts_user_date ON public.daily_thoughts (user_id, local_date);
