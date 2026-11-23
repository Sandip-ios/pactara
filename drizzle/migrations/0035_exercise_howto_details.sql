ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tips text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS variation_group text,
  ADD COLUMN IF NOT EXISTS image_bg text;

CREATE INDEX IF NOT EXISTS exercises_variation_group_idx ON public.exercises (variation_group) WHERE variation_group IS NOT NULL;