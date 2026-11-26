-- Change only the default for future inserts. Do not backfill existing profiles.
-- enforce_profile_teen_privacy continues to force under-18 profiles private.
-- Classic-target follow refusal and can_follow rules remain unchanged.
ALTER TABLE public.profiles ALTER COLUMN is_private SET DEFAULT false;