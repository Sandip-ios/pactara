REVOKE ALL ON public.follows,public.follow_notifications FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.follows,public.follow_notifications FROM authenticated;
GRANT SELECT ON public.follows,public.follow_notifications TO authenticated;
CREATE FUNCTION public.can_read_follow_notification(actor uuid,recipient uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid()=recipient AND public.is_new_version_user(auth.uid()) AND NOT public.safety_pair_blocked(actor,recipient) $$;
REVOKE ALL ON FUNCTION public.can_read_follow_notification(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_follow_notification(uuid,uuid) TO authenticated;
ALTER POLICY follow_notifications_recipient ON public.follow_notifications USING(public.can_read_follow_notification(actor_id,recipient_id));