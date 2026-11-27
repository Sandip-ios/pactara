DROP POLICY IF EXISTS "social post cheers own insert" ON public.social_post_cheers;
CREATE POLICY "social post cheers own insert" ON public.social_post_cheers FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_see_social_post(post_id, auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);