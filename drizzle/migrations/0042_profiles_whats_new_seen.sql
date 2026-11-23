ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whats_new_seen text;
COMMENT ON COLUMN public.profiles.whats_new_seen IS 'Latest What''s new version (e.g. 2026-11) the member has dismissed.';