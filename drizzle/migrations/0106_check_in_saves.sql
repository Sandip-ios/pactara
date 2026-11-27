CREATE TABLE public.check_in_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_id uuid NOT NULL REFERENCES public.check_ins(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, check_in_id)
);
CREATE INDEX check_in_saves_user_created_idx ON public.check_in_saves (user_id, created_at DESC);
CREATE INDEX check_in_saves_check_in_idx ON public.check_in_saves (check_in_id);
GRANT SELECT, INSERT, DELETE ON public.check_in_saves TO authenticated;
GRANT ALL ON public.check_in_saves TO service_role;
ALTER TABLE public.check_in_saves ENABLE ROW LEVEL SECURITY;
-- The EXISTS runs under check_ins RLS, so it reuses the existing check-in visibility rule.
CREATE POLICY "check in saves own read" ON public.check_in_saves FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.check_ins c WHERE c.id = check_in_id));
CREATE POLICY "check in saves own insert" ON public.check_in_saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.check_ins c WHERE c.id = check_in_id));
CREATE POLICY "check in saves own delete" ON public.check_in_saves FOR DELETE TO authenticated
  USING (user_id = auth.uid());