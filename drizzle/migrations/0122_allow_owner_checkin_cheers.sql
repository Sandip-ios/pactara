CREATE OR REPLACE FUNCTION public.home_checkin_action(_id uuid, _action text, _body text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c record; dp record; uid uuid:=auth.uid();
BEGIN
 IF NOT public.can_use_home_checkin(_id) THEN RAISE EXCEPTION 'Check-in unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.check_ins WHERE id=_id;
 SELECT * INTO dp FROM public.daily_posts WHERE user_id=c.user_id AND group_id=c.group_id AND local_date=c.checkin_date;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||_id::text||_action,0));
 IF _action='cheer' THEN
  IF EXISTS(SELECT 1 FROM public.post_reactions r WHERE r.post_id=dp.id AND r.user_id=uid AND (r.check_in_id=c.id OR r.check_in_id IS NULL AND dp.check_in_id=c.id)) THEN DELETE FROM public.post_reactions WHERE post_id=dp.id AND user_id=uid AND (check_in_id=c.id OR check_in_id IS NULL AND dp.check_in_id=c.id);
  ELSE INSERT INTO public.post_reactions(post_id,user_id,emoji,check_in_id) VALUES(dp.id,uid,'🔥',c.id); END IF;
 ELSIF _action='comment' THEN
  IF char_length(btrim(COALESCE(_body,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Write a comment'; END IF;
  INSERT INTO public.post_comments(post_id,user_id,body,check_in_id) VALUES(dp.id,uid,btrim(_body),c.id);
 ELSIF _action='save' THEN INSERT INTO public.check_in_saves(user_id,check_in_id) VALUES(uid,c.id) ON CONFLICT DO NOTHING;
 ELSIF _action='unsave' THEN DELETE FROM public.check_in_saves WHERE user_id=uid AND check_in_id=c.id;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.home_checkin_action(uuid,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.home_checkin_action(uuid,text,text) TO authenticated;