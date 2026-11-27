CREATE FUNCTION public.can_use_home_checkin(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_new_version_user(auth.uid()) AND EXISTS(SELECT 1 FROM public.check_ins c WHERE c.id=_id AND public.crew_is_active(c.group_id) AND NOT public.safety_pair_blocked(auth.uid(),c.user_id) AND (c.user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.user_id=auth.uid() AND gm.group_id=c.group_id) OR public.can_view_new_shared_checkin(c.id)) AND NOT EXISTS(SELECT 1 FROM public.hidden_posts h WHERE h.user_id=auth.uid() AND (h.post_id=c.id OR h.post_id IN(SELECT dp.id FROM public.daily_posts dp WHERE dp.user_id=c.user_id AND dp.group_id=c.group_id AND dp.local_date=c.checkin_date)))); $$;
REVOKE ALL ON FUNCTION public.can_use_home_checkin(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.can_use_home_checkin(uuid) TO authenticated;
CREATE FUNCTION public.get_home_checkin_social(_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; dp record; result jsonb;
BEGIN
 IF NOT public.can_use_home_checkin(_id) THEN RAISE EXCEPTION 'Check-in unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.check_ins WHERE id=_id;
 SELECT * INTO dp FROM public.daily_posts WHERE user_id=c.user_id AND group_id=c.group_id AND local_date=c.checkin_date;
 SELECT jsonb_build_object('cheered',EXISTS(SELECT 1 FROM public.post_reactions r WHERE r.post_id=dp.id AND r.user_id=auth.uid() AND (r.check_in_id=c.id OR r.check_in_id IS NULL AND dp.check_in_id=c.id)), 'cheers',(SELECT count(*) FROM public.post_reactions r WHERE r.post_id=dp.id AND (r.check_in_id=c.id OR r.check_in_id IS NULL AND dp.check_in_id=c.id) AND NOT public.safety_pair_blocked(r.user_id,auth.uid())), 'saved',EXISTS(SELECT 1 FROM public.check_in_saves s WHERE s.user_id=auth.uid() AND s.check_in_id=c.id), 'comments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',pc.id,'userId',pc.user_id,'name',p.name,'body',pc.body,'at',pc.created_at) ORDER BY pc.created_at) FROM public.post_comments pc JOIN public.profiles p ON p.id=pc.user_id WHERE pc.post_id=dp.id AND (pc.check_in_id=c.id OR pc.check_in_id IS NULL AND dp.check_in_id=c.id) AND NOT public.safety_pair_blocked(pc.user_id,auth.uid())),'[]'::jsonb), 'workoutDetail',(SELECT jsonb_build_object('title',ws.title,'summary',jsonb_build_object('exercises',ws.summary->'exercises','sets',ws.summary->'sets','minutes',ws.summary->'minutes','volume',0,'unit','kg','items','[]'::jsonb,'prs','[]'::jsonb),'isMine',c.user_id=auth.uid(),'savedWorkoutId',NULL,'dayLabel',NULL,'exercises',COALESCE((SELECT jsonb_agg(x.value ORDER BY x.position) FROM (SELECT l.position,jsonb_build_object('exerciseId',l.exercise_id,'name',e.name,'imageStart',e.image_start,'logType',e.log_type,'equipment',e.equipment,'sets',jsonb_agg(jsonb_build_object('weight',NULL,'unit','kg','reps',l.reps,'seconds',l.seconds,'isPr',false) ORDER BY l.set_no)) value FROM public.workout_set_logs l JOIN public.exercises e ON e.id=l.exercise_id WHERE l.session_id=ws.id GROUP BY l.position,l.exercise_id,e.name,e.image_start,e.log_type,e.equipment) x),'[]'::jsonb)) FROM public.workout_sessions ws WHERE ws.user_id=c.user_id AND ws.check_in_ids @> ARRAY[c.id] AND ws.logged_at IS NOT NULL LIMIT 1)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_home_checkin_social(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_home_checkin_social(uuid) TO authenticated;
CREATE FUNCTION public.home_checkin_action(_id uuid,_action text,_body text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; dp record; uid uuid:=auth.uid();
BEGIN
 IF NOT public.can_use_home_checkin(_id) THEN RAISE EXCEPTION 'Check-in unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.check_ins WHERE id=_id;
 SELECT * INTO dp FROM public.daily_posts WHERE user_id=c.user_id AND group_id=c.group_id AND local_date=c.checkin_date;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||_id::text||_action,0));
 IF _action='cheer' THEN
  IF c.user_id=uid THEN RAISE EXCEPTION 'Own check-in'; END IF;
  IF EXISTS(SELECT 1 FROM public.post_reactions r WHERE r.post_id=dp.id AND r.user_id=uid AND (r.check_in_id=c.id OR r.check_in_id IS NULL AND dp.check_in_id=c.id)) THEN DELETE FROM public.post_reactions WHERE post_id=dp.id AND user_id=uid AND (check_in_id=c.id OR check_in_id IS NULL AND dp.check_in_id=c.id);
  ELSE INSERT INTO public.post_reactions(post_id,user_id,emoji,check_in_id) VALUES(dp.id,uid,'🔥',c.id); END IF;
 ELSIF _action='comment' THEN
  IF char_length(btrim(COALESCE(_body,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Write a comment'; END IF;
  INSERT INTO public.post_comments(post_id,user_id,body,check_in_id) VALUES(dp.id,uid,btrim(_body),c.id);
 ELSIF _action='save' THEN INSERT INTO public.check_in_saves(user_id,check_in_id) VALUES(uid,c.id) ON CONFLICT DO NOTHING;
 ELSIF _action='unsave' THEN DELETE FROM public.check_in_saves WHERE user_id=uid AND check_in_id=c.id;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.home_checkin_action(uuid,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.home_checkin_action(uuid,text,text) TO authenticated;