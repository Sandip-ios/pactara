CREATE FUNCTION public.shares_active_crew_with(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT _a=_b OR EXISTS (SELECT 1 FROM public.group_members a JOIN public.group_members b ON b.group_id=a.group_id JOIN public.groups g ON g.id=a.group_id WHERE a.user_id=_a AND b.user_id=_b AND g.ended_at IS NULL) $$;
REVOKE ALL ON FUNCTION public.shares_active_crew_with(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_active_crew_with(uuid,uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.crew_active_plans() RETURNS TABLE(user_id uuid, plan_slug text, plan_name text, current_week integer, weeks integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT up.user_id,p.slug,p.name,up.current_week,p.weeks FROM public.user_plans up JOIN public.plans p ON p.id=up.plan_id WHERE up.status='active' AND auth.uid() IS NOT NULL AND up.user_id<>auth.uid() AND public.shares_active_crew_with(auth.uid(),up.user_id) $$;
CREATE OR REPLACE FUNCTION public.crew_on_plan(_plan_id uuid) RETURNS TABLE(user_id uuid, status text, current_week integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT DISTINCT ON (up.user_id) up.user_id,up.status,up.current_week FROM public.user_plans up WHERE up.plan_id=_plan_id AND up.status IN ('active','completed') AND auth.uid() IS NOT NULL AND up.user_id<>auth.uid() AND public.shares_active_crew_with(auth.uid(),up.user_id) ORDER BY up.user_id,(up.status='completed') DESC,up.created_at DESC $$;
CREATE OR REPLACE FUNCTION public.crew_workout_status() RETURNS TABLE(id uuid, group_id uuid, user_id uuid, started_at timestamptz, status text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT id,group_id,user_id,started_at,status FROM public.workout_sessions WHERE public.is_group_member(group_id,auth.uid()) AND public.crew_is_active(group_id) $$;
CREATE OR REPLACE FUNCTION public.post_health_check_in(_groups uuid[], _date date, _note text, _photo text, _mood text, _activity text, _health jsonb) RETURNS TABLE(check_in_id uuid, crew_id uuid) LANGUAGE plpgsql SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); gid uuid; cid uuid; stamp timestamptz := clock_timestamp(); old_ids uuid[];
BEGIN
 IF uid IS NULL OR cardinality(_groups) IS NULL OR cardinality(_groups)<1 OR cardinality(_groups)>20 OR _health IS NULL THEN RAISE EXCEPTION 'Invalid Health check-in'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(_groups) g WHERE NOT EXISTS (SELECT 1 FROM public.group_members m JOIN public.groups c ON c.id=m.group_id WHERE m.group_id=g AND m.user_id=uid AND c.ended_at IS NULL)) THEN RAISE EXCEPTION 'Not an active crew member'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || (_health->>'uuid'),0));
 IF EXISTS (SELECT 1 FROM public.check_ins c WHERE c.user_id=uid AND c.health_workout->>'uuid'=_health->>'uuid') THEN
  IF EXISTS (SELECT 1 FROM public.check_ins c WHERE c.user_id=uid AND c.health_workout->>'uuid'=_health->>'uuid' AND (c.photo_url IS DISTINCT FROM _photo OR c.health_workout IS DISTINCT FROM _health)) THEN RAISE EXCEPTION 'This Health workout has already been used'; END IF;
  IF (SELECT count(DISTINCT c.group_id) FROM public.check_ins c WHERE c.user_id=uid AND c.health_workout->>'uuid'=_health->>'uuid' AND c.group_id=ANY(_groups))<>cardinality(_groups) THEN RAISE EXCEPTION 'This Health workout has already been used'; END IF;
  RETURN QUERY SELECT c.id,c.group_id FROM public.check_ins c WHERE c.user_id=uid AND c.health_workout->>'uuid'=_health->>'uuid' AND c.group_id=ANY(_groups); RETURN;
 END IF;
 FOREACH gid IN ARRAY _groups LOOP
  INSERT INTO public.check_ins (user_id,group_id,checkin_date,note,photo_url,mood,activity,health_workout,created_at) VALUES (uid,gid,_date,left(_note,500),_photo,left(_mood,40),left(_activity,40),_health,stamp) RETURNING id INTO cid;
  INSERT INTO public.daily_posts (user_id,group_id,local_date,check_in_id,check_in_missed) VALUES (uid,gid,_date,cid,false) ON CONFLICT (user_id,group_id,local_date) DO UPDATE SET check_in_id=coalesce(public.daily_posts.check_in_id,EXCLUDED.check_in_id),check_in_missed=false;
  check_in_id:=cid;crew_id:=gid;RETURN NEXT;
 END LOOP;
END $$;