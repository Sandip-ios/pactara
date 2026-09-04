ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

ALTER TABLE public.post_comments ALTER COLUMN body SET DEFAULT '';