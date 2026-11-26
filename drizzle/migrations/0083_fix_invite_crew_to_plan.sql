CREATE OR REPLACE FUNCTION public.invite_crew_to_plan(_plan_id uuid, _group_id uuid)
RETURNS TABLE(id uuid, recipient_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
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
  ON CONFLICT ON CONSTRAINT plan_invite_notifications_recipient_id_actor_id_plan_id_key DO NOTHING
  RETURNING n.id, n.recipient_id;
END $$;