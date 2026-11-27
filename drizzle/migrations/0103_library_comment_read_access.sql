CREATE OR REPLACE FUNCTION public.can_read_library_comment(_post_id uuid, _author_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.can_see_social_post(_post_id, auth.uid())
    AND NOT public.safety_pair_blocked(_author_id, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.can_read_library_comment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_library_comment(uuid, uuid) TO authenticated, service_role;
ALTER POLICY "social post comments visible" ON public.social_post_comments
USING (public.can_read_library_comment(post_id, user_id));