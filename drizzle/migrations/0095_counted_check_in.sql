CREATE INDEX IF NOT EXISTS check_ins_user_group_day_idx ON public.check_ins (user_id, group_id, checkin_date, created_at, id);

CREATE OR REPLACE FUNCTION public.is_counted_check_in(_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.check_ins c WHERE c.id = _id)
     AND NOT EXISTS (
       SELECT 1 FROM public.check_ins c JOIN public.check_ins o
         ON o.user_id = c.user_id AND o.group_id = c.group_id AND o.checkin_date = c.checkin_date
       WHERE c.id = _id AND o.id <> c.id AND (o.created_at, o.id) < (c.created_at, c.id)
     )
$$;
GRANT EXECUTE ON FUNCTION public.is_counted_check_in(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.repoint_daily_post_after_check_in_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.daily_posts p
     SET check_in_id = (
       SELECT c.id FROM public.check_ins c
        WHERE c.user_id = OLD.user_id AND c.group_id = OLD.group_id AND c.checkin_date = OLD.checkin_date
        ORDER BY c.created_at, c.id LIMIT 1)
   WHERE p.user_id = OLD.user_id AND p.group_id = OLD.group_id AND p.local_date = OLD.checkin_date
     AND (p.check_in_id IS NULL OR p.check_in_id = OLD.id);
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.repoint_daily_post_after_check_in_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER repoint_daily_post_after_check_in_delete
AFTER DELETE ON public.check_ins FOR EACH ROW
EXECUTE FUNCTION public.repoint_daily_post_after_check_in_delete();