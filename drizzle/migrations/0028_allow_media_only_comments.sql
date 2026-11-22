ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_body_check;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_body_check
  CHECK (length(body) <= 1000 AND (length(body) > 0 OR media_url IS NOT NULL));