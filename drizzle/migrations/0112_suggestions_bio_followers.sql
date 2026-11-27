CREATE OR REPLACE FUNCTION public.get_new_home_suggestions() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) INTO result FROM (SELECT p.id,p.name,p.avatar_url,p.avatar_color,
   NULLIF(btrim(split_part(COALESCE(p.bio,''),E'\n',1)),'') AS bio_line,
   (SELECT count(*) FROM public.follows f2 WHERE f2.following_id=p.id AND f2.status='accepted')::int AS followers
  FROM public.profiles p WHERE p.id<>uid AND public.is_new_version_user(p.id) AND NOT p.is_private AND NOT COALESCE(p.birthday>(current_date-interval '18 years')::date,false) AND NOT public.safety_pair_blocked(uid,p.id) AND NOT EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=uid AND f.following_id=p.id) ORDER BY p.created_at DESC,p.id DESC LIMIT 5) x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_new_home_suggestions() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_new_home_suggestions() TO authenticated;