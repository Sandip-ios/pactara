ALTER TABLE public.profiles
  ADD COLUMN app_version text NOT NULL DEFAULT 'classic',
  ADD COLUMN new_version_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN username text,
  ADD COLUMN bio text,
  ADD COLUMN birthday date,
  ADD COLUMN is_private boolean NOT NULL DEFAULT true,
  ADD COLUMN interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN new_version_seen_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_app_version_check CHECK (app_version IN ('classic','new')),
  ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9._]{3,30}$'),
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 150);
CREATE UNIQUE INDEX profiles_username_key ON public.profiles (username);

-- Private new fields: other members (groupmates) can no longer read them.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, name, avatar_color, created_at, avatar_url, timezone, streak_freezes_available, weight_unit, whats_new_seen, plan_quiz, health_prompt_seen_at, username) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_app_prefs()
RETURNS TABLE (app_version text, new_version_enabled boolean, username text, bio text, birthday date, is_private boolean, interests text[], new_version_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.app_version, p.new_version_enabled, p.username, p.bio, p.birthday, p.is_private, p.interests, p.new_version_seen_at
  FROM public.profiles p WHERE p.id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_app_prefs() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_app_prefs() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_usernames(_ids uuid[])
RETURNS TABLE (id uuid, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username FROM public.profiles p WHERE p.id = ANY(_ids) AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_usernames(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_usernames(uuid[]) TO authenticated;

-- Members cannot grant themselves the rollout flag.
CREATE OR REPLACE FUNCTION public.protect_new_version_enabled()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.new_version_enabled IS DISTINCT FROM OLD.new_version_enabled
     AND coalesce(auth.role(), '') IN ('authenticated','anon') THEN
    NEW.new_version_enabled := OLD.new_version_enabled;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_new_version_enabled
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_new_version_enabled();