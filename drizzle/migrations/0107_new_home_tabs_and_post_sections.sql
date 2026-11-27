ALTER TABLE public.social_posts ADD COLUMN meal jsonb;
ALTER TABLE public.workouts ADD COLUMN source_post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX workouts_source_post_unique ON public.workouts(user_id,source_post_id) WHERE source_post_id IS NOT NULL;
CREATE TABLE public.meals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, source_post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL, name text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,source_post_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved meals" ON public.meals FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE FUNCTION public.toggle_post_attachment(_post_id uuid,_kind text,_on boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); p public.social_posts; result uuid; moves jsonb;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 IF _kind NOT IN ('workout','meal') THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||_post_id::text||_kind,0));
 IF NOT _on THEN
  IF _kind='workout' THEN DELETE FROM public.workouts WHERE user_id=uid AND source_post_id=_post_id; ELSE DELETE FROM public.meals WHERE user_id=uid AND source_post_id=_post_id; END IF;
  RETURN NULL;
 END IF;
 SELECT * INTO p FROM public.social_posts WHERE id=_post_id;
 IF NOT FOUND OR p.user_id=uid OR NOT public.can_see_social_post(_post_id,uid) OR public.safety_pair_blocked(uid,p.user_id) THEN RAISE EXCEPTION 'Post unavailable' USING ERRCODE='42501'; END IF;
 IF _kind='workout' THEN
  IF p.workout IS NULL THEN RAISE EXCEPTION 'No workout'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('exerciseId',m->>'exerciseId','sets',jsonb_array_length(m->'sets'),'reps',(m->'sets'->0->'reps'),'seconds',(m->'sets'->0->'seconds'),'restSeconds',90) ORDER BY pos),'[]'::jsonb) INTO moves FROM jsonb_array_elements(p.workout->'moves') WITH ORDINALITY AS x(m,pos);
  INSERT INTO public.workouts(user_id,name,exercises,source_post_id,source_user_id) VALUES(uid,p.workout->>'title',moves,p.id,p.user_id) ON CONFLICT(user_id,source_post_id) WHERE source_post_id IS NOT NULL DO UPDATE SET source_post_id=EXCLUDED.source_post_id RETURNING id INTO result;
 ELSE
  IF p.meal IS NULL THEN RAISE EXCEPTION 'No meal'; END IF;
  INSERT INTO public.meals(user_id,name,snapshot,source_post_id) VALUES(uid,p.meal->>'title',p.meal,p.id) ON CONFLICT(user_id,source_post_id) DO UPDATE SET source_post_id=EXCLUDED.source_post_id RETURNING id INTO result;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.toggle_post_attachment(uuid,text,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.toggle_post_attachment(uuid,text,boolean) TO authenticated;
CREATE FUNCTION public.can_view_new_shared_checkin(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_new_version_user(auth.uid()) AND EXISTS(SELECT 1 FROM public.check_ins c JOIN public.profiles p ON p.id=c.user_id WHERE c.id=_id AND public.crew_is_active(c.group_id) AND NOT public.safety_pair_blocked(c.user_id,auth.uid()) AND c.share_with_followers AND (NOT p.is_private AND NOT COALESCE(p.birthday>(current_date-interval '18 years')::date,false) OR EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=auth.uid() AND f.following_id=c.user_id AND f.status='accepted')));
$$;
REVOKE ALL ON FUNCTION public.can_view_new_shared_checkin(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.can_view_new_shared_checkin(uuid) TO authenticated;
CREATE FUNCTION public.get_new_home_refs(_tab text,_before jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 IF _tab NOT IN ('following','for-you') THEN RAISE EXCEPTION 'Invalid tab'; END IF;
 WITH crews AS (SELECT gm.group_id FROM public.group_members gm JOIN public.groups g ON g.id=gm.group_id WHERE gm.user_id=uid AND g.ended_at IS NULL AND gm.archived_at IS NULL),
 peers AS (SELECT DISTINCT gm.user_id FROM public.group_members gm JOIN crews cr ON cr.group_id=gm.group_id WHERE gm.archived_at IS NULL),
 followed AS (SELECT following_id FROM public.follows WHERE follower_id=uid AND status='accepted'),
 posts AS (SELECT 'post'::text kind,p.id,p.created_at,'post:'||p.id::text key,NULL::uuid group_id,NULL::text crew_name FROM public.social_posts p WHERE p.status='live' AND public.can_see_social_post(p.id,uid) AND NOT public.safety_pair_blocked(p.user_id,uid) AND NOT EXISTS(SELECT 1 FROM public.hidden_posts h WHERE h.user_id=uid AND h.post_id=p.id) AND CASE WHEN _tab='following' THEN p.user_id=uid OR EXISTS(SELECT 1 FROM public.social_post_crews pc JOIN crews cr ON cr.group_id=pc.group_id WHERE pc.post_id=p.id) OR p.audience='everyone' AND p.user_id IN(SELECT following_id FROM followed) ELSE p.audience='everyone' AND NOT p.skip_discover AND p.user_id<>uid AND p.user_id NOT IN(SELECT user_id FROM peers) AND p.user_id NOT IN(SELECT following_id FROM followed) END),
 checks_raw AS (SELECT c.*,g.name crew_name, row_number() OVER(PARTITION BY c.user_id,COALESCE(c.photo_url,c.id::text),c.checkin_date ORDER BY (c.group_id IN(SELECT group_id FROM crews)) DESC,c.created_at DESC,c.id DESC) rn FROM public.check_ins c JOIN public.groups g ON g.id=c.group_id JOIN public.profiles p ON p.id=c.user_id WHERE g.ended_at IS NULL AND NOT public.safety_pair_blocked(c.user_id,uid) AND NOT EXISTS(SELECT 1 FROM public.hidden_posts h WHERE h.user_id=uid AND (h.post_id=c.id OR h.post_id IN(SELECT dp.id FROM public.daily_posts dp WHERE dp.group_id=c.group_id AND dp.user_id=c.user_id AND dp.local_date=c.checkin_date))) AND CASE WHEN _tab='following' THEN c.user_id=uid OR c.group_id IN(SELECT group_id FROM crews) OR c.user_id IN(SELECT following_id FROM followed) AND public.can_view_new_shared_checkin(c.id) ELSE c.user_id<>uid AND c.user_id NOT IN(SELECT user_id FROM peers) AND c.user_id NOT IN(SELECT following_id FROM followed) AND c.share_with_followers AND NOT p.is_private AND NOT COALESCE(p.birthday>(current_date-interval '18 years')::date,false) END),
 checks AS (SELECT 'checkin'::text kind,c.id,c.created_at,'checkin:'||c.id::text key,c.group_id,CASE WHEN c.group_id IN(SELECT group_id FROM crews) THEN c.crew_name END crew_name FROM checks_raw c WHERE rn=1),
 page AS (SELECT * FROM (SELECT * FROM posts UNION ALL SELECT * FROM checks) all_items WHERE _before IS NULL OR (created_at,key)<((_before->>'at')::timestamptz,_before->>'key') ORDER BY created_at DESC,key DESC LIMIT 21)
 SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,key DESC),'[]'::jsonb) INTO result FROM page;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_new_home_refs(text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_new_home_refs(text,jsonb) TO authenticated;
CREATE FUNCTION public.get_new_home_checkins(_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'groupId',c.group_id,'localDate',c.checkin_date,'createdAt',c.created_at,'note',c.note,'activity',c.activity,'mood',c.mood,'photoUrl',c.photo_url,'health',c.health_workout,'name',p.name,'avatarUrl',p.avatar_url,'avatarColor',p.avatar_color,'postId',dp.id,'workout',(SELECT jsonb_build_object('title',ws.title,'exercises',COALESCE((ws.summary->>'exercises')::int,0),'sets',COALESCE((ws.summary->>'sets')::int,0),'minutes',COALESCE((ws.summary->>'minutes')::int,0),'pr',NULL,'prCount',0) FROM public.workout_sessions ws WHERE ws.user_id=c.user_id AND ws.check_in_ids @> ARRAY[c.id] AND ws.logged_at IS NOT NULL LIMIT 1))), '[]'::jsonb) INTO result FROM public.check_ins c JOIN public.profiles p ON p.id=c.user_id JOIN public.groups g ON g.id=c.group_id LEFT JOIN public.daily_posts dp ON dp.user_id=c.user_id AND dp.group_id=c.group_id AND dp.local_date=c.checkin_date WHERE c.id=ANY(_ids) AND g.ended_at IS NULL AND NOT public.safety_pair_blocked(c.user_id,uid) AND (c.user_id=uid OR EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id=c.group_id AND gm.user_id=uid AND gm.archived_at IS NULL) OR public.can_view_new_shared_checkin(c.id)) AND NOT EXISTS(SELECT 1 FROM public.hidden_posts h WHERE h.user_id=uid AND h.post_id IN(c.id,dp.id));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_new_home_checkins(uuid[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_new_home_checkins(uuid[]) TO authenticated;
CREATE FUNCTION public.get_new_home_suggestions() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) INTO result FROM (SELECT p.id,p.name,p.avatar_url,p.avatar_color FROM public.profiles p WHERE p.id<>uid AND public.is_new_version_user(p.id) AND NOT p.is_private AND NOT COALESCE(p.birthday>(current_date-interval '18 years')::date,false) AND NOT public.safety_pair_blocked(uid,p.id) AND NOT EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=uid AND f.following_id=p.id) ORDER BY p.created_at DESC,p.id DESC LIMIT 5) x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_new_home_suggestions() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_new_home_suggestions() TO authenticated;