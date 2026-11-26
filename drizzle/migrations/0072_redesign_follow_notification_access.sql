CREATE FUNCTION public.can_read_follow_notifications() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND public.is_new_version_user(auth.uid()) $$;
REVOKE ALL ON FUNCTION public.can_read_follow_notifications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_follow_notifications() TO authenticated;
ALTER POLICY follow_notifications_recipient ON public.follow_notifications USING(recipient_id=auth.uid() AND public.can_read_follow_notifications() AND NOT public.safety_pair_blocked(actor_id,recipient_id));
CREATE FUNCTION public.claim_follow_pushes(actor uuid) RETURNS SETOF public.follow_notifications LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.follow_notifications SET push_claimed_at=now() WHERE id IN (
 SELECT n.id FROM public.follow_notifications n WHERE n.actor_id=actor AND n.push_claimed_at IS NULL AND n.created_at>now()-interval '1 day'
 AND public.is_new_version_user(n.recipient_id) AND NOT public.safety_pair_blocked(n.actor_id,n.recipient_id)
 ORDER BY n.created_at LIMIT 100 FOR UPDATE SKIP LOCKED
 ) RETURNING *
$$;
REVOKE ALL ON FUNCTION public.claim_follow_pushes(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_follow_pushes(uuid) TO service_role;
CREATE FUNCTION public.get_visible_follow_profile_stats(target uuid,viewer uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF viewer IS NULL OR public.safety_pair_blocked(viewer,target) OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=target AND (p.id=viewer OR (NOT p.is_private AND NOT coalesce(p.birthday>(CURRENT_DATE-interval '18 years')::date,false)) OR EXISTS(SELECT 1 FROM public.follows WHERE follower_id=viewer AND following_id=target AND status='accepted'))) THEN RETURN NULL; END IF;
 RETURN public.get_follow_profile_stats(target);
END $$;
REVOKE ALL ON FUNCTION public.get_visible_follow_profile_stats(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_follow_profile_stats(uuid,uuid) TO service_role;