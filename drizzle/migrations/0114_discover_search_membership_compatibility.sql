CREATE OR REPLACE FUNCTION public.search_discover_people(query_text text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); adult boolean; result jsonb;
BEGIN
 IF u IS NULL OR NOT public.is_new_version_user(u) THEN RAISE EXCEPTION 'New version required'; END IF;
 SELECT NOT coalesce(birthday>(CURRENT_DATE-interval '18 years')::date,false) INTO adult FROM public.profiles WHERE id=u;
 SELECT coalesce(jsonb_agg(row_data ORDER BY rank,name,id),'[]'::jsonb) INTO result FROM (
 SELECT p.id,p.name,CASE WHEN p.id=u THEN 0 ELSE 1 END AS rank,jsonb_build_object('id',p.id,'name',coalesce(nullif(trim(p.name),''),p.username,'Member'),'username',p.username,'bio',p.bio,'avatar',p.avatar_url,'isPrivate',p.is_private OR coalesce(p.birthday>(CURRENT_DATE-interval '18 years')::date,false),'relationship',public.get_profile(p.id::text)->>'relationship','canFollow',coalesce((public.get_profile(p.id::text)->>'can_follow')::boolean,false),'isYou',p.id=u,'context',coalesce((SELECT 'In '||g.name||' with you' FROM public.groups g JOIN public.group_members a ON a.group_id=g.id JOIN public.group_members b ON b.group_id=g.id WHERE a.user_id=u AND b.user_id=p.id AND g.ended_at IS NULL ORDER BY a.joined_at DESC,g.id LIMIT 1),CASE WHEN EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=p.id AND f.following_id=u AND f.status='accepted') THEN 'Follows you' ELSE coalesce(p.bio,'') END)) AS row_data
 FROM public.profiles p WHERE public.is_new_version_user(p.id) AND NOT public.safety_pair_blocked(u,p.id)
 AND NOT (adult AND coalesce(p.birthday>(CURRENT_DATE-interval '18 years')::date,false) AND p.id<>u)
 AND trim(coalesce(query_text,''))<>'' AND NOT EXISTS(SELECT 1 FROM regexp_split_to_table(public.discover_search_text(trim(left(query_text,80))), '\s+') word WHERE strpos(public.discover_search_text(coalesce(p.name,'')||' '||coalesce(p.username,'')),word)=0)
 ) matched;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.search_discover_people(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_discover_people(text) TO authenticated;