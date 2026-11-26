ALTER TABLE public.user_plans
  ADD COLUMN starts_on date,
  ADD COLUMN training_days smallint[],
  ADD COLUMN paused_at timestamptz;
ALTER TABLE public.user_plans ADD CONSTRAINT user_plans_training_days_valid
  CHECK (training_days IS NULL OR (cardinality(training_days) BETWEEN 1 AND 7 AND training_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]));

CREATE OR REPLACE FUNCTION public.plan_active_count(_plan_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN 0 ELSE (SELECT count(DISTINCT user_id)::int FROM public.user_plans WHERE plan_id = _plan_id AND status = 'active') END
$$;
REVOKE EXECUTE ON FUNCTION public.plan_active_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_active_count(uuid) TO authenticated;

CREATE TABLE public.plan_invite_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, actor_id, plan_id)
);
GRANT SELECT ON public.plan_invite_notifications TO authenticated;
GRANT ALL ON public.plan_invite_notifications TO service_role;
ALTER TABLE public.plan_invite_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_invites_recipient ON public.plan_invite_notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() AND public.is_new_version_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.invite_crew_to_plan(_plan_id uuid, _group_id uuid)
RETURNS TABLE(id uuid, recipient_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members m JOIN public.groups g ON g.id = m.group_id
                 WHERE m.group_id = _group_id AND m.user_id = uid AND g.ended_at IS NULL) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_plans up WHERE up.user_id = uid AND up.plan_id = _plan_id AND up.status = 'active') THEN RETURN; END IF;
  RETURN QUERY
  INSERT INTO public.plan_invite_notifications AS n (recipient_id, actor_id, plan_id, group_id)
  SELECT m.user_id, uid, _plan_id, _group_id
  FROM public.group_members m
  WHERE m.group_id = _group_id AND m.user_id <> uid
    AND public.is_new_version_user(m.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.user_plans up WHERE up.user_id = m.user_id AND up.plan_id = _plan_id AND up.status = 'active')
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id = uid AND b.blocked_id = m.user_id) OR (b.blocker_id = m.user_id AND b.blocked_id = uid))
  ON CONFLICT (recipient_id, actor_id, plan_id) DO NOTHING
  RETURNING n.id, n.recipient_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.invite_crew_to_plan(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_crew_to_plan(uuid, uuid) TO authenticated;