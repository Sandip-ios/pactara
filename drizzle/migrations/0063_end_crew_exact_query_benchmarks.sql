CREATE POLICY "Ended crew check-ins preserve own history" ON public.check_ins AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id) OR user_id=auth.uid());
CREATE POLICY "Ended crew posts preserve own history" ON public.daily_posts AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id) OR user_id=auth.uid());
CREATE POLICY "Ended crew chat is closed" ON public.group_messages AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id));
CREATE POLICY "Ended crew comments are closed" ON public.post_comments AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.daily_posts p WHERE p.id=post_id AND public.crew_is_active(p.group_id)));
CREATE POLICY "Ended crew reactions are closed" ON public.post_reactions AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.daily_posts p WHERE p.id=post_id AND public.crew_is_active(p.group_id)));
CREATE POLICY "Ended crew message reactions are closed" ON public.message_reactions AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.group_messages m WHERE m.id=message_id AND public.crew_is_active(m.group_id)));
CREATE POLICY "Ended crew comment likes are closed" ON public.comment_likes AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.post_comments c JOIN public.daily_posts p ON p.id=c.post_id WHERE c.id=comment_id AND public.crew_is_active(p.group_id)));
CREATE POLICY "Ended crew cheers are closed" ON public.workout_cheers AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id));
CREATE FUNCTION public.qa_end_crew_benchmark(_case text,_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p record; plan jsonb;
BEGIN
 IF auth.uid() IS DISTINCT FROM 'e4a82436-4cbe-4a28-86eb-91e99666a44a'::uuid THEN RAISE EXCEPTION 'Review account only'; END IF;
 CASE _case
 WHEN 'home_posts' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,user_id,local_date,morning_ritual_text,morning_ritual_posted_at,morning_missed,check_in_missed,updated_at,created_at FROM public.daily_posts WHERE group_id='0152e7ee-ee06-4ca8-ac5b-fe9572c823da' AND local_date>='2026-11-17' ORDER BY updated_at DESC LIMIT 1000 LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'crew_check_ins' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,user_id,checkin_date,mood,activity,note,photo_url,created_at,health_workout FROM public.check_ins WHERE group_id='0152e7ee-ee06-4ca8-ac5b-fe9572c823da' AND checkin_date IN ('2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22','2026-11-23') AND user_id=ANY(_ids) LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'profile_history' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT checkin_date FROM public.check_ins WHERE user_id=auth.uid() AND group_id='0152e7ee-ee06-4ca8-ac5b-fe9572c823da' LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'chat' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,user_id,body,image_url,created_at,shared_workout_code,shared_plan_slug FROM public.group_messages WHERE group_id='0152e7ee-ee06-4ca8-ac5b-fe9572c823da' ORDER BY created_at ASC LIMIT 200 LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'comments' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,post_id,user_id,body,media_url,media_type,created_at FROM public.post_comments WHERE post_id=ANY(_ids) LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'post_reactions' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT post_id,user_id,emoji,created_at FROM public.post_reactions WHERE post_id=ANY(_ids) ORDER BY created_at ASC LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'message_reactions' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT message_id,user_id,emoji FROM public.message_reactions WHERE message_id=ANY(_ids) LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'comment_likes' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT comment_id,user_id FROM public.comment_likes WHERE comment_id=ANY(_ids) LOOP plan:=p."QUERY PLAN"; END LOOP;
 WHEN 'workout_cheers' THEN FOR p IN EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT emoji,user_id FROM public.workout_cheers WHERE session_id=_ids[1] LOOP plan:=p."QUERY PLAN"; END LOOP;
 ELSE RAISE EXCEPTION 'Unknown benchmark'; END CASE; RETURN plan;
END $$;
REVOKE ALL ON FUNCTION public.qa_end_crew_benchmark(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qa_end_crew_benchmark(text,uuid[]) TO authenticated;