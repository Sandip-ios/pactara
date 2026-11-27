ALTER TABLE public.social_posts ADD COLUMN pinned_at timestamptz;
CREATE INDEX social_posts_user_pins_idx ON public.social_posts (user_id, pinned_at DESC NULLS LAST, created_at DESC);