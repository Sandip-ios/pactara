CREATE OR REPLACE FUNCTION public.discover_owner_eligible(_owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = _owner AND pr.new_version_enabled AND pr.app_version = 'new'
      AND pr.is_private = false
      AND (pr.birthday IS NULL OR pr.birthday <= (current_date - interval '18 years'))
  )
$$;
REVOKE ALL ON FUNCTION public.discover_owner_eligible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_discover_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE items jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.shared_workouts WHERE discover AND workout_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NOT public.discover_owner_eligible(NEW.user_id)
     OR NEW.source_session_id IS NOT NULL OR NEW.source_share_code IS NOT NULL OR NEW.source_user_id IS NOT NULL THEN
    DELETE FROM public.shared_workouts WHERE discover AND pactara_key IS NULL AND workout_id = NEW.id;
    RETURN NEW;
  END IF;
  items := public.workout_snapshot_items(NEW.exercises);
  IF jsonb_array_length(items) = 0 THEN
    DELETE FROM public.shared_workouts WHERE discover AND pactara_key IS NULL AND workout_id = NEW.id;
    RETURN NEW;
  END IF;
  UPDATE public.shared_workouts SET name = NEW.name, exercises = items, equipment = NEW.equipment, updated_at = now()
    WHERE discover AND workout_id = NEW.id AND (name IS DISTINCT FROM NEW.name OR exercises IS DISTINCT FROM items OR equipment IS DISTINCT FROM NEW.equipment);
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.shared_workouts WHERE discover AND workout_id = NEW.id) THEN
    INSERT INTO public.shared_workouts (code, owner_id, workout_id, name, exercises, discover, equipment, created_at)
    VALUES (public.random_share_code(), NEW.user_id, NEW.id, NEW.name, items, true, NEW.equipment, NEW.created_at)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_discover_snapshot() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_discover_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.id = public.pactara_author_id() THEN RETURN NEW; END IF;
  IF public.discover_owner_eligible(NEW.id) THEN
    UPDATE public.workouts SET name = name WHERE user_id = NEW.id;
  ELSE
    DELETE FROM public.shared_workouts WHERE discover AND pactara_key IS NULL AND owner_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_discover_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_discover_owner ON public.profiles;
CREATE TRIGGER profiles_discover_owner AFTER UPDATE OF is_private, app_version, new_version_enabled, birthday ON public.profiles
  FOR EACH ROW
  WHEN (OLD.is_private IS DISTINCT FROM NEW.is_private OR OLD.app_version IS DISTINCT FROM NEW.app_version
     OR OLD.new_version_enabled IS DISTINCT FROM NEW.new_version_enabled OR OLD.birthday IS DISTINCT FROM NEW.birthday)
  EXECUTE FUNCTION public.sync_discover_owner();

DELETE FROM public.shared_workouts s
WHERE s.discover AND s.pactara_key IS NULL AND s.owner_id IS DISTINCT FROM public.pactara_author_id()
  AND NOT public.discover_owner_eligible(s.owner_id);