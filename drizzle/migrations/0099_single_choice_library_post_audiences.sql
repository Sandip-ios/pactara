ALTER TABLE public.social_posts ADD COLUMN audience text NOT NULL DEFAULT 'crews';
UPDATE public.social_posts SET audience = CASE WHEN audience_everyone THEN 'everyone' ELSE 'crews' END;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_audience_check CHECK (audience IN ('everyone','crews','only_me'));
COMMENT ON COLUMN public.social_posts.audience_everyone IS 'DEPRECATED: compatibility mirror of audience; new code uses audience';

CREATE OR REPLACE FUNCTION public.can_see_social_post(_post_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id=_post_id AND (p.user_id=_viewer OR (
 p.status='live' AND p.audience<>'only_me' AND NOT public.safety_pair_blocked(p.user_id,_viewer) AND (
 EXISTS (SELECT 1 FROM public.social_post_crews pc JOIN public.group_members gm ON gm.group_id=pc.group_id AND gm.user_id=_viewer JOIN public.groups g ON g.id=gm.group_id AND g.ended_at IS NULL WHERE pc.post_id=p.id)
 OR (p.audience='everyone' AND NOT COALESCE((SELECT pr.birthday > (current_date-interval '18 years')::date FROM public.profiles pr WHERE pr.id=p.user_id),false) AND (
 NOT COALESCE((SELECT pr.is_private FROM public.profiles pr WHERE pr.id=p.user_id),true) OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id=_viewer AND f.following_id=p.user_id AND f.status='accepted')))
 ))));
$$;

CREATE OR REPLACE FUNCTION public.social_posts_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b date; total numeric;
BEGIN
 IF NEW.audience='everyone' THEN
 SELECT birthday INTO b FROM public.profiles WHERE id=NEW.user_id;
 IF b IS NOT NULL AND b>(current_date-interval '18 years')::date THEN RAISE EXCEPTION 'Under-18 accounts cannot post to Everyone' USING ERRCODE='42501'; END IF;
 END IF;
 NEW.audience_everyone := NEW.audience='everyone';
 IF NEW.audience='only_me' THEN NEW.comments_on:=false; END IF;
 IF TG_OP='UPDATE' AND NEW.audience IS DISTINCT FROM OLD.audience THEN
 SELECT COALESCE(sum(GREATEST(0,COALESCE(trim_end,duration_s,0)-COALESCE(trim_start,0))),0) INTO total FROM public.social_post_items WHERE post_id=NEW.id AND kind='video';
 IF total>600.5 THEN RAISE EXCEPTION 'Videos can be up to 10:00 total. Trim them to post.' USING ERRCODE='22023'; END IF;
 IF NEW.audience='crews' AND EXISTS(SELECT 1 FROM public.social_post_items WHERE post_id=NEW.id AND kind='video' AND COALESCE(trim_end,duration_s,0)-COALESCE(trim_start,0)>180.5) THEN RAISE EXCEPTION 'Crew-only posts take videos up to 3:00. Trim it or choose Everyone.' USING ERRCODE='22023'; END IF;
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;

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
 IF _audience='only_me' THEN DELETE FROM public.social_post_tags WHERE post_id=_post_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_social_post_audience(uuid,text,uuid[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_social_post_audience(uuid,text,uuid[]) TO authenticated;

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
 IF _audience<>'only_me' THEN INSERT INTO public.social_post_tags(post_id,user_id) SELECT pid,x FROM unnest(COALESCE(_tags,'{}')) x WHERE x<>uid AND NOT public.safety_pair_blocked(uid,x) ON CONFLICT DO NOTHING; END IF;
 FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_items,'[]')) LOOP
 IF split_part(it->>'path','/',1)<>uid::text OR (it->>'poster_path' IS NOT NULL AND split_part(it->>'poster_path','/',1)<>uid::text) THEN RAISE EXCEPTION 'Bad media path' USING ERRCODE='42501'; END IF;
 INSERT INTO public.social_post_items(post_id,position,kind,path,poster_path,duration_s,trim_start,trim_end,muted,cover_s,crop)
 VALUES(pid,i,it->>'kind',it->>'path',it->>'poster_path',(it->>'duration_s')::numeric,(it->>'trim_start')::numeric,(it->>'trim_end')::numeric,COALESCE((it->>'muted')::boolean,false),(it->>'cover_s')::numeric,it->'crop'); i:=i+1;
 END LOOP;
 RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.create_library_post_v2(text,text,uuid[],jsonb,jsonb,uuid,uuid,uuid,boolean,uuid[],boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.create_library_post_v2(text,text,uuid[],jsonb,jsonb,uuid,uuid,uuid,boolean,uuid[],boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_social_post(_caption text,_everyone boolean,_group_ids uuid[],_items jsonb,_workout jsonb,_workout_session_id uuid,_workout_id uuid,_credit_user_id uuid,_comments_on boolean,_tags uuid[],_skip_discover boolean)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
 SELECT public.create_library_post_v2(_caption,CASE WHEN _everyone THEN 'everyone' ELSE 'crews' END,_group_ids,_items,_workout,_workout_session_id,_workout_id,_credit_user_id,_comments_on,_tags,_skip_discover);
$$;

CREATE OR REPLACE FUNCTION public.social_post_items_length_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a text; len numeric; total numeric;
BEGIN
 IF NEW.kind<>'video' THEN RETURN NEW; END IF;
 SELECT audience INTO a FROM public.social_posts WHERE id=NEW.post_id FOR UPDATE;
 len:=GREATEST(0,COALESCE(NEW.trim_end,NEW.duration_s,0)-COALESCE(NEW.trim_start,0));
 SELECT COALESCE(sum(GREATEST(0,COALESCE(trim_end,duration_s,0)-COALESCE(trim_start,0))),0)+len INTO total FROM public.social_post_items WHERE post_id=NEW.post_id AND kind='video' AND id<>NEW.id;
 IF total>600.5 THEN RAISE EXCEPTION 'Videos can be up to 10:00 total. Trim them to post.' USING ERRCODE='22023'; END IF;
 IF a='crews' AND len>180.5 THEN RAISE EXCEPTION 'Crew-only posts take videos up to 3:00. Trim it or choose Everyone.' USING ERRCODE='22023'; END IF;
 IF len>180.5 THEN UPDATE public.social_posts SET skip_discover=true WHERE id=NEW.post_id AND NOT skip_discover; END IF;
 RETURN NEW;
END $$;

REVOKE UPDATE ON public.social_posts FROM authenticated;
GRANT UPDATE(caption,status,comments_on) ON public.social_posts TO authenticated;
DROP POLICY "social post saves read" ON public.social_post_saves;
CREATE POLICY "social post saves read" ON public.social_post_saves FOR SELECT TO authenticated USING (public.can_see_social_post(post_id,auth.uid()) AND (user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.social_posts p WHERE p.id=post_id AND p.user_id=auth.uid())));
