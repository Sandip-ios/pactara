CREATE TABLE public.group_member_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz,
  left_at timestamptz NOT NULL DEFAULT now(),
  pact_signed_at timestamptz,
  personal_goal text,
  personal_goal_set_at timestamptz
);

CREATE INDEX group_member_departures_user_idx ON public.group_member_departures (user_id, group_id);

GRANT SELECT ON public.group_member_departures TO authenticated;
GRANT ALL ON public.group_member_departures TO service_role;

ALTER TABLE public.group_member_departures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own departures"
  ON public.group_member_departures FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.leave_crew(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  SELECT owner_id INTO _owner FROM public.groups WHERE id = _group_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Crew not found';
  END IF;
  IF _owner = _uid THEN
    RAISE EXCEPTION 'You created this crew. Delete it instead of leaving.';
  END IF;
  INSERT INTO public.group_member_departures (group_id, user_id, joined_at, pact_signed_at, personal_goal, personal_goal_set_at)
  SELECT group_id, user_id, joined_at, pact_signed_at, personal_goal, personal_goal_set_at
  FROM public.group_members
  WHERE group_id = _group_id AND user_id = _uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not in this crew';
  END IF;
  DELETE FROM public.group_members WHERE group_id = _group_id AND user_id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_crew(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_crew(uuid) TO authenticated;