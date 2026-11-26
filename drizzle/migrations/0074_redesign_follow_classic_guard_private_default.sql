ALTER TABLE public.profiles ALTER COLUMN is_private SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.follow_user(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); s text; r public.follows; BEGIN
 PERFORM public.lock_follow_pair(u,target);
 IF NOT public.is_new_version_user(target) THEN RAISE EXCEPTION 'This person can''t be followed yet'; END IF;
 SELECT * INTO r FROM public.follows WHERE follower_id=u AND following_id=target;
 IF FOUND THEN RETURN jsonb_build_object('status',r.status,'changed',false); END IF;
 SELECT CASE WHEN is_private OR birthday>(CURRENT_DATE-interval '18 years')::date THEN 'requested' ELSE 'accepted' END INTO s FROM public.profiles WHERE id=target;
 INSERT INTO public.follows(follower_id,following_id,status,accepted_at) VALUES(u,target,s,CASE WHEN s='accepted' THEN now() END);
 INSERT INTO public.follow_notifications(actor_id,recipient_id,kind) VALUES(u,target,CASE WHEN s='accepted' THEN 'follow' ELSE 'follow_request' END);
 RETURN jsonb_build_object('status',s,'changed',true);
END $$;

CREATE OR REPLACE FUNCTION public.get_profile(target text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.profiles; u uuid:=auth.uid(); relationship text; visible boolean; result jsonb; BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id::text=target OR username=lower(target) LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 relationship:=CASE WHEN public.safety_pair_blocked(u,p.id) THEN 'blocked'
 WHEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=u AND following_id=p.id AND status='accepted') THEN 'following'
 WHEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=u AND following_id=p.id AND status='requested') THEN 'requested'
 WHEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=p.id AND following_id=u AND status='accepted') THEN 'follows_you' ELSE 'none' END;
 visible:=relationship<>'blocked' AND (p.id=u OR (NOT p.is_private AND NOT coalesce(p.birthday>(CURRENT_DATE-interval '18 years')::date,false)) OR relationship='following');
 result:=jsonb_build_object('id',p.id,'name',p.name,'username',p.username,'bio',p.bio,'avatar',p.avatar_url,
 'follower_count',(SELECT count(*) FROM public.follows WHERE following_id=p.id AND status='accepted'),
 'following_count',(SELECT count(*) FROM public.follows WHERE follower_id=p.id AND status='accepted'),
 'is_private',p.is_private OR coalesce(p.birthday>(CURRENT_DATE-interval '18 years')::date,false),'relationship',relationship,
 'can_follow',public.is_new_version_user(p.id) AND p.id<>u AND relationship<>'blocked');
 IF visible THEN result:=result || jsonb_build_object('shares_crew',EXISTS(SELECT 1 FROM public.group_members a JOIN public.group_members b ON a.group_id=b.group_id WHERE a.user_id=u AND b.user_id=p.id)); END IF;
 RETURN result;
END $$;