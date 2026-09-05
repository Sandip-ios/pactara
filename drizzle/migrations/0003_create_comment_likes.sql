CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view comment likes"
ON public.comment_likes FOR SELECT TO authenticated
USING (public.shares_group_with(auth.uid(), (SELECT pc.user_id FROM public.post_comments pc WHERE pc.id = comment_likes.comment_id)));

CREATE POLICY "Group members can like comments"
ON public.comment_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.shares_group_with(auth.uid(), (SELECT pc.user_id FROM public.post_comments pc WHERE pc.id = comment_likes.comment_id)));

CREATE POLICY "Users can remove their own comment likes"
ON public.comment_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_comment_likes_comment ON public.comment_likes(comment_id);