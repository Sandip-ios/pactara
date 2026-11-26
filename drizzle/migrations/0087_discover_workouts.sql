ALTER TABLE public.shared_workouts
  ADD COLUMN IF NOT EXISTS discover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pactara_key text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS equipment text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
COMMENT ON COLUMN public.shared_workouts.discover IS 'Discover listing snapshot (one per public workout, or a Pactara plan-day workout). Ordinary share links stay false.';
COMMENT ON COLUMN public.shared_workouts.pactara_key IS 'Pactara workouts only: hash of the exercises, so identical plan days are listed once.';
CREATE UNIQUE INDEX IF NOT EXISTS shared_workouts_pactara_key_uidx ON public.shared_workouts (pactara_key) WHERE pactara_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shared_workouts_discover_workout_uidx ON public.shared_workouts (workout_id) WHERE discover AND workout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workouts_source_share_code_idx ON public.workouts (source_share_code) WHERE source_share_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS workout_sessions_workout_logged_idx ON public.workout_sessions (workout_id) WHERE logged_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.pactara_author_id() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '00000000-0000-4000-8000-0000000000aa'::uuid $$;

CREATE OR REPLACE FUNCTION public.random_share_code() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', 1 + floor(random()*57)::int, 1), '') FROM generate_series(1, 8)
$$;

CREATE OR REPLACE FUNCTION public.workout_snapshot_items(_items jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'exerciseId', i->>'exerciseId',
      'sets', least(10, greatest(1, coalesce((i->>'sets')::numeric, 3)::int)),
      'repsTarget', CASE WHEN e.log_type = 'timed' THEN NULL ELSE '8-12' END,
      'secondsTarget', CASE WHEN e.log_type = 'timed' THEN (i->>'seconds')::numeric::int END
    ) || jsonb_strip_nulls(jsonb_build_object('reps', nullif(i->>'reps', ''), 'tip', nullif(i->>'tip', '')))
    ORDER BY o), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_items) = 'array' THEN _items ELSE '[]'::jsonb END) WITH ORDINALITY AS t(i, o)
  JOIN public.exercises e ON e.id = i->>'exerciseId'
$$;

CREATE OR REPLACE FUNCTION public.sync_discover_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE items jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.shared_workouts WHERE discover AND workout_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.source_session_id IS NOT NULL OR NEW.source_share_code IS NOT NULL OR NEW.source_user_id IS NOT NULL THEN
    DELETE FROM public.shared_workouts WHERE discover AND workout_id = NEW.id;
    RETURN NEW;
  END IF;
  items := public.workout_snapshot_items(NEW.exercises);
  IF jsonb_array_length(items) = 0 THEN
    DELETE FROM public.shared_workouts WHERE discover AND workout_id = NEW.id;
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

DROP TRIGGER IF EXISTS workouts_discover_snapshot ON public.workouts;
CREATE TRIGGER workouts_discover_snapshot AFTER INSERT OR UPDATE OF name, exercises, equipment, source_session_id, source_share_code, source_user_id OR DELETE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.sync_discover_snapshot();

CREATE OR REPLACE FUNCTION public.refresh_pactara_workouts() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH moves AS (
    SELECT p.id AS plan_id, p.sort_order, p.cover_url, p.equipment_key, d.id AS day_id, d.title, d.week_number, d.day_number, m.o,
           m.mv->>'exercise_id' AS ex_id,
           regexp_match(coalesce(m.mv->>'dose', ''), '^\s*(\d+)\s*[x×]\s*(\d+(?:-\d+)?)\s*(sec|secs|seconds|s|min|mins|minutes)?\M(.*)$', 'i') AS mt
    FROM public.plans p JOIN public.plan_days d ON d.plan_id = p.id
    CROSS JOIN LATERAL jsonb_array_elements(d.moves) WITH ORDINALITY AS m(mv, o)
    WHERE p.is_published
  ), items AS (
    SELECT mv.*, e.log_type,
      jsonb_build_object(
        'exerciseId', mv.ex_id,
        'sets', least(10, greatest(1, mv.mt[1]::int)),
        'repsTarget', CASE WHEN mv.mt[3] IS NULL THEN mv.mt[2] END,
        'secondsTarget', CASE WHEN mv.mt[3] ~* '^m' THEN split_part(mv.mt[2], '-', 1)::int * 60 WHEN mv.mt[3] IS NOT NULL THEN split_part(mv.mt[2], '-', 1)::int END
      ) || CASE WHEN mv.mt[3] IS NULL THEN jsonb_build_object('reps', mv.mt[2] || CASE WHEN mv.mt[4] ~* '\meach' THEN ' each' ELSE '' END) ELSE '{}'::jsonb END AS item
    FROM moves mv JOIN public.exercises e ON e.id = mv.ex_id
    WHERE mv.mt IS NOT NULL
  ), days AS (
    SELECT plan_id, sort_order, cover_url, equipment_key, day_id, title, week_number, day_number,
           jsonb_agg(item ORDER BY o) AS exercises
    FROM items GROUP BY plan_id, sort_order, cover_url, equipment_key, day_id, title, week_number, day_number
    HAVING count(*) >= 2
  ), uniq AS (
    SELECT DISTINCT ON (md5(exercises::text)) md5(exercises::text) AS k, *
    FROM days ORDER BY md5(exercises::text), sort_order, coalesce(week_number, 0), day_number
  ), up AS (
    INSERT INTO public.shared_workouts (code, owner_id, workout_id, name, exercises, discover, pactara_key, cover_url, equipment)
    SELECT public.random_share_code(), public.pactara_author_id(), NULL, left(u.title, 60), u.exercises, true, u.k, u.cover_url,
           CASE u.equipment_key WHEN 'gym' THEN 'gym' WHEN 'dumbbells' THEN 'dumbbells' WHEN 'kettlebell' THEN 'dumbbells' ELSE 'home' END
    FROM uniq u
    ON CONFLICT (pactara_key) WHERE pactara_key IS NOT NULL DO UPDATE SET name = excluded.name, cover_url = excluded.cover_url, equipment = excluded.equipment, updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO n FROM up;
  DELETE FROM public.shared_workouts s WHERE s.pactara_key IS NOT NULL AND s.updated_at < now();
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.refresh_pactara_workouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_pactara_workouts() TO service_role;
REVOKE ALL ON FUNCTION public.workout_snapshot_items(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_discover_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.random_share_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.discover_author_visible(_owner uuid, _viewer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner = public.pactara_author_id() OR (
    _owner IS DISTINCT FROM _viewer
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = _owner AND pr.new_version_enabled AND pr.app_version = 'new'
        AND pr.is_private = false
        AND (pr.birthday IS NULL OR pr.birthday <= (current_date - interval '18 years'))
    )
    AND NOT public.safety_pair_blocked(_owner, _viewer)
  )
$$;
REVOKE ALL ON FUNCTION public.discover_author_visible(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.discover_workout_feed()
RETURNS TABLE (
  code text, name text, exercises jsonb, equipment text, cover_url text, pactara boolean, owner_id uuid,
  owner_name text, created_at timestamptz, saves integer, saves_week integer, did_it integer,
  my_copy_id uuid, my_copy_name text, my_copy_exercises jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  listed AS (
    SELECT s.* FROM public.shared_workouts s, me
    WHERE s.discover AND auth.uid() IS NOT NULL
      AND (s.pactara_key IS NOT NULL OR (s.workout_id IS NOT NULL AND public.discover_author_visible(s.owner_id, me.uid)))
    ORDER BY s.created_at DESC
    LIMIT 1000
  ),
  codes AS (
    SELECT l.code AS listed_code, x.code
    FROM listed l
    JOIN public.shared_workouts x ON x.code = l.code OR (l.workout_id IS NOT NULL AND x.workout_id = l.workout_id)
  ),
  copies AS (
    SELECT c.listed_code, w.id, w.user_id, w.created_at, w.name, w.exercises
    FROM codes c JOIN public.workouts w ON w.source_share_code = c.code
  )
  SELECT l.code, l.name, l.exercises, coalesce(l.equipment, ow.equipment), l.cover_url, l.pactara_key IS NOT NULL, l.owner_id,
    CASE WHEN l.pactara_key IS NULL THEN pr.name END, l.created_at,
    (SELECT count(DISTINCT cp.user_id)::int FROM copies cp WHERE cp.listed_code = l.code),
    (SELECT count(DISTINCT cp.user_id)::int FROM copies cp WHERE cp.listed_code = l.code AND cp.created_at > now() - interval '7 days'),
    (SELECT count(DISTINCT ws.user_id)::int FROM public.workout_sessions ws
      WHERE ws.logged_at IS NOT NULL AND (ws.workout_id = l.workout_id OR ws.workout_id IN (SELECT cp.id FROM copies cp WHERE cp.listed_code = l.code))),
    mc.id, mc.name, mc.exercises
  FROM listed l
  LEFT JOIN public.workouts ow ON ow.id = l.workout_id
  LEFT JOIN public.profiles pr ON pr.id = l.owner_id
  LEFT JOIN LATERAL (SELECT cp.id, cp.name, cp.exercises FROM copies cp, me WHERE cp.listed_code = l.code AND cp.user_id = me.uid ORDER BY cp.created_at LIMIT 1) mc ON true
$$;
REVOKE ALL ON FUNCTION public.discover_workout_feed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_workout_feed() TO authenticated;

INSERT INTO public.shared_workouts (code, owner_id, workout_id, name, exercises, discover, equipment, created_at)
SELECT public.random_share_code(), w.user_id, w.id, w.name, public.workout_snapshot_items(w.exercises), true, w.equipment, w.created_at
FROM public.workouts w
WHERE w.source_session_id IS NULL AND w.source_share_code IS NULL AND w.source_user_id IS NULL
  AND jsonb_array_length(public.workout_snapshot_items(w.exercises)) > 0
ON CONFLICT DO NOTHING;
SELECT public.refresh_pactara_workouts();