ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS solo_nudge_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS solo_nudged_at timestamptz;