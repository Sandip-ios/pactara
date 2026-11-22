DROP FUNCTION IF EXISTS public.plan_tags_for_check_ins(uuid[]);
CREATE FUNCTION public.plan_tags_for_check_ins(_check_in_ids uuid[])
RETURNS TABLE(check_in_id uuid, plan_name text, plan_slug text, week integer, day_number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.check_in_id, p.name, p.slug, l.week, l.day_number
  FROM public.plan_workout_logs l
  JOIN public.user_plans up ON up.id = l.user_plan_id
  JOIN public.plans p ON p.id = up.plan_id
  JOIN public.check_ins ci ON ci.id = l.check_in_id
  WHERE l.check_in_id = ANY(_check_in_ids)
    AND auth.uid() IS NOT NULL
    AND public.is_group_member(ci.group_id, auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.plan_tags_for_check_ins(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_tags_for_check_ins(uuid[]) TO authenticated;