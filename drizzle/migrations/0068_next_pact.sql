ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS previous_start_date date, ADD COLUMN IF NOT EXISTS previous_duration_days integer;

CREATE TABLE public.pact_member_seen (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  pact_start date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('done','banner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id, pact_start, kind)
);
GRANT SELECT, INSERT ON public.pact_member_seen TO authenticated;
GRANT ALL ON public.pact_member_seen TO service_role;
ALTER TABLE public.pact_member_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own pact seen" ON public.pact_member_seen FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members add own pact seen" ON public.pact_member_seen FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = pact_member_seen.group_id AND gm.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.start_next_pact(_group_id uuid, _duration_days integer, _days_per_week integer, _start date)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  SELECT * INTO g FROM public.groups WHERE id = _group_id FOR UPDATE;
  IF g IS NULL OR g.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who runs this crew can start the next pact'; END IF;
  IF g.ended_at IS NOT NULL THEN RAISE EXCEPTION 'This crew has ended'; END IF;
  IF _duration_days NOT IN (30, 60, 90) THEN RAISE EXCEPTION 'Pick 30, 60 or 90 days'; END IF;
  IF _days_per_week < 1 OR _days_per_week > 7 THEN RAISE EXCEPTION 'Workouts a week must be 1 to 7'; END IF;
  IF _start < current_date - 1 OR _start > current_date + 1 THEN RAISE EXCEPTION 'Invalid start day'; END IF;
  IF _start <= COALESCE(g.start_date, g.created_at::date) + COALESCE(g.duration_days, 30) - 1 THEN RAISE EXCEPTION 'The current pact is not done yet'; END IF;
  UPDATE public.groups SET
    previous_start_date = COALESCE(g.start_date, g.created_at::date),
    previous_duration_days = COALESCE(g.duration_days, 30),
    start_date = _start,
    duration_days = _duration_days,
    days_per_week = _days_per_week,
    frequency = CASE WHEN _days_per_week = COALESCE(g.days_per_week, 7) THEN g.frequency WHEN _days_per_week = 7 THEN 'daily' ELSE 'weekly' END
  WHERE id = _group_id;
  RETURN _start;
END $$;
REVOKE ALL ON FUNCTION public.start_next_pact(uuid, integer, integer, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_next_pact(uuid, integer, integer, date) TO authenticated;