ALTER TABLE public.post_reactions ADD COLUMN check_in_id uuid REFERENCES public.check_ins(id) ON DELETE CASCADE;
ALTER TABLE public.post_comments ADD COLUMN check_in_id uuid REFERENCES public.check_ins(id) ON DELETE CASCADE;
CREATE INDEX post_reactions_check_in_idx ON public.post_reactions(check_in_id) WHERE check_in_id IS NOT NULL;
CREATE INDEX post_comments_check_in_idx ON public.post_comments(check_in_id) WHERE check_in_id IS NOT NULL;
ALTER TABLE public.post_reactions DROP CONSTRAINT post_reactions_post_id_user_id_emoji_key;
CREATE UNIQUE INDEX post_reactions_post_check_in_user_emoji_key ON public.post_reactions(post_id, COALESCE(check_in_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id, emoji);
CREATE OR REPLACE FUNCTION public.check_in_belongs_to_post(_post uuid, _check_in uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _check_in IS NULL OR EXISTS (
    SELECT 1 FROM public.daily_posts p JOIN public.check_ins c ON c.user_id = p.user_id AND c.group_id = p.group_id
    WHERE p.id = _post AND c.id = _check_in)
$$;
REVOKE EXECUTE ON FUNCTION public.check_in_belongs_to_post(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_belongs_to_post(uuid, uuid) TO authenticated, service_role;
CREATE POLICY "Cheer check-in belongs to post" ON public.post_reactions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.check_in_belongs_to_post(post_id, check_in_id));
CREATE POLICY "Reply check-in belongs to post" ON public.post_comments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.check_in_belongs_to_post(post_id, check_in_id));