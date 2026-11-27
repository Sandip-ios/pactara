ALTER TABLE public.social_post_tags ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.social_post_tags ADD COLUMN IF NOT EXISTS notified_at timestamptz;
UPDATE public.social_post_tags t SET created_at=p.created_at, notified_at=p.created_at FROM public.social_posts p WHERE p.id=t.post_id;
CREATE INDEX IF NOT EXISTS social_post_tags_user_idx ON public.social_post_tags(user_id, created_at DESC);
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS tags_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.is_under_18(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT birthday>(current_date-interval '18 years')::date FROM public.profiles WHERE id=_user),false) $$;
REVOKE ALL ON FUNCTION public.is_under_18(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_under_18(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.can_tag_user(_author uuid,_audience text,_group_ids uuid[],_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _target IS NOT NULL AND _target<>_author AND _audience IN ('everyone','crews')
 AND public.is_new_version_user(_target)
 AND NOT public.safety_pair_blocked(_author,_target)
 AND (
  EXISTS(SELECT 1 FROM public.group_members a JOIN public.group_members b ON b.group_id=a.group_id AND b.user_id=_target JOIN public.groups g ON g.id=a.group_id AND g.ended_at IS NULL
         WHERE a.user_id=_author AND (_audience='everyone' OR a.group_id=ANY(COALESCE(_group_ids,'{}'))))
  OR (_audience='everyone'
   AND public.is_under_18(_author)=public.is_under_18(_target)
   AND EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=_author AND f.following_id=_target AND f.status='accepted')
   AND (NOT COALESCE((SELECT is_private FROM public.profiles WHERE id=_author),true)
        OR EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=_target AND f.following_id=_author AND f.status='accepted')))
 ) $$;
REVOKE ALL ON FUNCTION public.can_tag_user(uuid,text,uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_tag_user(uuid,text,uuid[],uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_taggable_people(_audience text,_group_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH me AS (SELECT auth.uid() u),
 chosen AS (SELECT CASE WHEN _audience='everyone' THEN (SELECT COALESCE(array_agg(gm.group_id),'{}') FROM public.group_members gm JOIN public.groups g ON g.id=gm.group_id AND g.ended_at IS NULL, me WHERE gm.user_id=me.u) ELSE COALESCE(_group_ids,'{}') END ids),
 crew AS (SELECT DISTINCT ON (b.user_id) b.user_id id, g.name crew FROM me, chosen, public.group_members a JOIN public.groups g ON g.id=a.group_id AND g.ended_at IS NULL JOIN public.group_members b ON b.group_id=a.group_id
   WHERE a.user_id=me.u AND a.group_id=ANY(chosen.ids) AND b.user_id<>me.u ORDER BY b.user_id, g.name),
 fol AS (SELECT f.following_id id FROM me, public.follows f WHERE f.follower_id=me.u AND f.status='accepted' AND _audience='everyone' AND f.following_id NOT IN (SELECT id FROM crew)),
 allp AS (SELECT id,'crew' section,crew sub FROM crew UNION ALL SELECT id,'follow',NULL FROM fol)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'name',COALESCE(NULLIF(trim(p.name),''),p.username,'Member'),'username',p.username,'avatar',p.avatar_url,'avatarColor',p.avatar_color,'section',x.section,'crew',x.sub) ORDER BY x.section, lower(COALESCE(p.name,p.username,''))),'[]')
 FROM allp x JOIN public.profiles p ON p.id=x.id, me, chosen
 WHERE me.u IS NOT NULL AND public.can_tag_user(me.u,_audience,chosen.ids,x.id) $$;
REVOKE ALL ON FUNCTION public.get_taggable_people(text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_taggable_people(text,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.prune_social_post_tags(_post_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 DELETE FROM public.social_post_tags t USING public.social_posts p WHERE p.id=t.post_id AND t.post_id=_post_id
 AND NOT public.can_tag_user(p.user_id,p.audience,ARRAY(SELECT group_id FROM public.social_post_crews WHERE post_id=_post_id),t.user_id) $$;
REVOKE ALL ON FUNCTION public.prune_social_post_tags(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_social_post_tags(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_social_post_audience(_post_id uuid,_audience text,_group_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); chosen uuid[]; g uuid;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.social_posts WHERE id=_post_id AND user_id=uid FOR UPDATE) THEN RAISE EXCEPTION 'Post not found' USING ERRCODE='42501'; END IF;
 IF _audience NOT IN ('everyone','crews','only_me') OR _audience IS NULL THEN RAISE EXCEPTION 'Pick who sees it' USING ERRCODE='22023'; END IF;
 IF _audience='everyone' THEN SELECT COALESCE(array_agg(gm.group_id),'{}'::uuid[]) INTO chosen FROM public.group_members gm JOIN public.groups gr ON gr.id=gm.group_id AND gr.ended_at IS NULL WHERE gm.user_id=uid;
 ELSIF _audience='only_me' THEN chosen:='{}'; ELSE chosen:=COALESCE(_group_ids,'{}'); END IF;
 IF _audience='crews' AND cardinality(chosen)=0 THEN RAISE EXCEPTION 'Pick at least one crew' USING ERRCODE='22023'; END IF;
 FOREACH g IN ARRAY chosen LOOP IF NOT EXISTS(SELECT 1 FROM public.group_members gm JOIN public.groups gr ON gr.id=gm.group_id AND gr.ended_at IS NULL WHERE gm.group_id=g AND gm.user_id=uid) THEN RAISE EXCEPTION 'Not in that crew' USING ERRCODE='42501'; END IF; END LOOP;
 UPDATE public.social_posts SET audience=_audience WHERE id=_post_id;
 DELETE FROM public.social_post_crews WHERE post_id=_post_id;
 INSERT INTO public.social_post_crews(post_id,group_id) SELECT _post_id,x FROM unnest(chosen) x ON CONFLICT DO NOTHING;
 PERFORM public.prune_social_post_tags(_post_id);
END $$;

CREATE OR REPLACE FUNCTION public.set_social_post_tags(_post_id uuid,_tags uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); p record;
BEGIN
 SELECT * INTO p FROM public.social_posts WHERE id=_post_id AND user_id=uid FOR UPDATE;
 IF uid IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'Post not found' USING ERRCODE='42501'; END IF;
 DELETE FROM public.social_post_tags WHERE post_id=_post_id AND NOT (user_id=ANY(COALESCE(_tags,'{}')));
 INSERT INTO public.social_post_tags(post_id,user_id) SELECT _post_id,x FROM unnest(COALESCE(_tags,'{}')) x
  WHERE public.can_tag_user(uid,p.audience,ARRAY(SELECT group_id FROM public.social_post_crews WHERE post_id=_post_id),x) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.set_social_post_tags(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_social_post_tags(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_me_from_social_post(_post_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 DELETE FROM public.social_post_tags WHERE post_id=_post_id AND user_id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.remove_me_from_social_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_me_from_social_post(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_social_post_tag_pushes(_post_id uuid) RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.social_post_tags t SET notified_at=now()
 FROM public.social_posts p
 WHERE p.id=t.post_id AND t.post_id=_post_id AND p.user_id=auth.uid() AND p.status='live' AND t.notified_at IS NULL
 AND public.can_see_social_post(_post_id,t.user_id)
 RETURNING t.user_id $$;
REVOKE ALL ON FUNCTION public.claim_social_post_tag_pushes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_social_post_tag_pushes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_library_post_v2(_caption text,_audience text,_group_ids uuid[],_items jsonb,_workout jsonb,_workout_session_id uuid,_workout_id uuid,_credit_user_id uuid,_comments_on boolean,_tags uuid[],_skip_discover boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); pid uuid; it jsonb; i int:=0; chosen uuid[]; g uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE='42501'; END IF;
 IF _audience NOT IN ('everyone','crews','only_me') OR _audience IS NULL THEN RAISE EXCEPTION 'Pick who sees it' USING ERRCODE='22023'; END IF;
 IF _audience='everyone' THEN SELECT COALESCE(array_agg(gm.group_id),'{}'::uuid[]) INTO chosen FROM public.group_members gm JOIN public.groups gr ON gr.id=gm.group_id AND gr.ended_at IS NULL WHERE gm.user_id=uid;
 ELSIF _audience='only_me' THEN chosen:='{}'; ELSE chosen:=COALESCE(_group_ids,'{}'); END IF;
 IF _audience='crews' AND cardinality(chosen)=0 THEN RAISE EXCEPTION 'Pick at least one crew' USING ERRCODE='22023'; END IF;
 FOREACH g IN ARRAY chosen LOOP IF NOT EXISTS(SELECT 1 FROM public.group_members gm JOIN public.groups gr ON gr.id=gm.group_id AND gr.ended_at IS NULL WHERE gm.group_id=g AND gm.user_id=uid) THEN RAISE EXCEPTION 'Not in that crew' USING ERRCODE='42501'; END IF; END LOOP;
 IF jsonb_array_length(COALESCE(_items,'[]'))>10 THEN RAISE EXCEPTION 'Up to 10 items' USING ERRCODE='22023'; END IF;
 INSERT INTO public.social_posts(user_id,caption,audience,comments_on,workout,workout_session_id,workout_id,credit_user_id,skip_discover,status)
 VALUES(uid,COALESCE(_caption,''),_audience,CASE WHEN _audience='only_me' THEN false ELSE COALESCE(_comments_on,true) END,_workout,_workout_session_id,_workout_id,_credit_user_id,COALESCE(_skip_discover,false),CASE WHEN jsonb_array_length(COALESCE(_items,'[]'))=0 THEN 'live' ELSE 'uploading' END) RETURNING id INTO pid;
 INSERT INTO public.social_post_crews(post_id,group_id) SELECT pid,x FROM unnest(chosen) x ON CONFLICT DO NOTHING;
 IF _audience<>'only_me' THEN INSERT INTO public.social_post_tags(post_id,user_id) SELECT pid,x FROM unnest(COALESCE(_tags,'{}')) x WHERE public.can_tag_user(uid,_audience,chosen,x) ON CONFLICT DO NOTHING; END IF;
 FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_items,'[]')) LOOP
 IF split_part(it->>'path','/',1)<>uid::text OR (it->>'poster_path' IS NOT NULL AND split_part(it->>'poster_path','/',1)<>uid::text) THEN RAISE EXCEPTION 'Bad media path' USING ERRCODE='42501'; END IF;
 INSERT INTO public.social_post_items(post_id,position,kind,path,poster_path,duration_s,trim_start,trim_end,muted,cover_s,crop)
 VALUES(pid,i,it->>'kind',it->>'path',it->>'poster_path',(it->>'duration_s')::numeric,(it->>'trim_start')::numeric,(it->>'trim_end')::numeric,COALESCE((it->>'muted')::boolean,false),(it->>'cover_s')::numeric,it->'crop'); i:=i+1;
 END LOOP;
 RETURN pid;
END $$;