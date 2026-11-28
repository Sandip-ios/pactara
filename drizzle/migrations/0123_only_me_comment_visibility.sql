CREATE OR REPLACE FUNCTION public.can_read_library_comment(_post_id uuid, _author_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.can_see_social_post(_post_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = _post_id AND p.audience <> 'only_me'
    )
    AND NOT public.safety_pair_blocked(_author_id, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.can_read_library_comment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_library_comment(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "social post comments own insert" ON public.social_post_comments;
CREATE POLICY "social post comments own insert" ON public.social_post_comments FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND public.can_read_library_comment(post_id, user_id)
  AND EXISTS (
    SELECT 1 FROM public.social_posts p
    WHERE p.id = post_id AND p.audience <> 'only_me' AND p.comments_on
  )
);

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
 UPDATE public.social_posts
 SET audience=_audience,
     comments_on=CASE
       WHEN _audience='only_me' THEN false
       WHEN audience='only_me' THEN true
       ELSE comments_on
     END
 WHERE id=_post_id;
 DELETE FROM public.social_post_crews WHERE post_id=_post_id;
 INSERT INTO public.social_post_crews(post_id,group_id) SELECT _post_id,x FROM unnest(chosen) x ON CONFLICT DO NOTHING;
 PERFORM public.prune_social_post_tags(_post_id);
END $$;
REVOKE ALL ON FUNCTION public.set_social_post_audience(uuid,text,uuid[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_social_post_audience(uuid,text,uuid[]) TO authenticated;