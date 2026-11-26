CREATE TABLE public.workout_cover_photos (
  key text PRIMARY KEY,
  focus text NOT NULL CHECK (focus IN ('back','chest','shoulders','arms','legs','glutes','core','full_body')),
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 3),
  equipment text[] NOT NULL DEFAULT '{}',
  url text NOT NULL,
  credit text NOT NULL,
  source text NOT NULL,
  source_url text NOT NULL,
  UNIQUE (focus, slot)
);
GRANT SELECT ON public.workout_cover_photos TO authenticated;
GRANT ALL ON public.workout_cover_photos TO service_role;
ALTER TABLE public.workout_cover_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read workout cover credits" ON public.workout_cover_photos
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.workout_cover_photos (key, focus, slot, equipment, url, credit, source, source_url)
SELECT * FROM (VALUES
('back-1','back',1,ARRAY['gym']::text[],'/__l5e/assets-v1/85135b17-1c9a-4bcb-ad90-736a5ae2c3dd/back-1.jpg','Stefan Vibes','Unsplash','https://images.unsplash.com/photo-1790094180990-02826069d59b?w=1200&q=80&fit=crop&auto=format'),
('back-2','back',2,ARRAY['gym']::text[],'/__l5e/assets-v1/81fafd46-051e-45a7-a3df-139bb862c047/back-2.jpg','Matthew Sichkaruk','Unsplash','https://images.unsplash.com/photo-1609899537878-88d5ba429bdb?w=1200&q=80&fit=crop&auto=format'),
('back-3','back',3,ARRAY['gym']::text[],'/__l5e/assets-v1/46c26811-dc31-463d-8878-2cce76901388/back-3.jpg','Victor Freitas','Unsplash','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80&fit=crop&auto=format'),
('chest-1','chest',1,ARRAY['home']::text[],'/__l5e/assets-v1/1171389f-4eab-4e47-9bab-f69c86fe443f/chest-1.jpg','Gordon Cowie','Unsplash','https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=1200&q=80&fit=crop&auto=format'),
('chest-2','chest',2,ARRAY['home']::text[],'/__l5e/assets-v1/977e79ee-4e72-414c-9355-8d9e1a3eac0c/chest-2.jpg','Ayo Ogunseinde','Unsplash','https://images.unsplash.com/photo-1514512364185-4c2b0985be01?w=1200&q=80&fit=crop&auto=format'),
('chest-3','chest',3,ARRAY['home']::text[],'/__l5e/assets-v1/83ac026e-531c-4163-88ad-b0a876dbc00e/chest-3.jpg','bruce mars','Unsplash','https://images.unsplash.com/photo-1518644961665-ed172691aaa1?w=1200&q=80&fit=crop&auto=format'),
('shoulders-1','shoulders',1,ARRAY['gym']::text[],'/__l5e/assets-v1/c2ae6abb-8f94-4108-a70e-490916e5f3e9/shoulders-1.jpg','John Arano','Unsplash','https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1200&q=80&fit=crop&auto=format'),
('shoulders-2','shoulders',2,ARRAY['gym']::text[],'/__l5e/assets-v1/cc4e283f-35a7-4064-96d3-7c3755f91775/shoulders-2.jpg','John Arano','Unsplash','https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1200&q=80&fit=crop&auto=format'),
('shoulders-3','shoulders',3,ARRAY['dumbbells','gym']::text[],'/__l5e/assets-v1/7dd527ea-28ae-4cdd-8104-1efab3e32c90/shoulders-3.jpg','Luke Witter','Unsplash','https://images.unsplash.com/photo-1641337221253-fdc7237f6b61?w=1200&q=80&fit=crop&auto=format'),
('arms-1','arms',1,ARRAY['dumbbells']::text[],'/__l5e/assets-v1/a64ab78d-b61d-4a27-b2c0-60e012d5feef/arms-1.jpg','Ambitious Studio / Rick Barrett','Unsplash','https://images.unsplash.com/photo-1674834727149-00812f907676?w=1200&q=80&fit=crop&auto=format'),
('arms-2','arms',2,ARRAY['dumbbells']::text[],'/__l5e/assets-v1/4ee99315-6d66-4ab8-b5ca-5f37cdc5db8c/arms-2.jpg','Alexander Redl','Unsplash','https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80&fit=crop&auto=format'),
('arms-3','arms',3,ARRAY['dumbbells','gym']::text[],'/__l5e/assets-v1/767090eb-3f7e-4b5a-bb34-266e19763fb8/arms-3.jpg','Anastase Maragos','Unsplash','https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=1200&q=80&fit=crop&auto=format'),
('legs-1','legs',1,ARRAY['home']::text[],'/__l5e/assets-v1/fd0654f4-4281-448d-a8b6-1a3b59b71a05/legs-1.jpg','SUNDAY II SUNDAY','Unsplash','https://images.unsplash.com/photo-1649887974297-4be052375a67?w=1200&q=80&fit=crop&auto=format'),
('legs-2','legs',2,ARRAY['bands','home']::text[],'/__l5e/assets-v1/e533b8f9-6930-401f-bf1e-08423e1bb49d/legs-2.jpg','Gabriel Alenius','Unsplash','https://images.unsplash.com/photo-1552226351-1ac7863af926?w=1200&q=80&fit=crop&auto=format'),
('legs-3','legs',3,ARRAY['gym']::text[],'/__l5e/assets-v1/7241236e-9c22-4ed6-8e32-dfe208f332dc/legs-3.jpg','Alef Morais','Unsplash','https://images.unsplash.com/photo-1770664612843-b44e26070024?w=1200&q=80&fit=crop&auto=format'),
('glutes-1','glutes',1,ARRAY['gym']::text[],'/__l5e/assets-v1/c2ceeb74-6762-469b-8090-a70628a6ab65/glutes-1.jpg','Galina Bogdanova','Unsplash','https://images.unsplash.com/photo-1784819482930-07768d5db6f6?w=1200&q=80&fit=crop&auto=format'),
('glutes-2','glutes',2,ARRAY['home']::text[],'/__l5e/assets-v1/6111efde-81c7-4b8e-b53a-3f5acbe903c6/glutes-2.jpg','McCarthy Beckan','Unsplash','https://images.unsplash.com/photo-1603455778956-d71832eafa4e?w=1200&q=80&fit=crop&auto=format'),
('glutes-3','glutes',3,ARRAY['home']::text[],'/__l5e/assets-v1/8db8e6ba-3a63-4c48-b34d-a7b9693d2a14/glutes-3.jpg','Isaac Wendland','Unsplash','https://images.unsplash.com/photo-1581889470536-467bdbe30cd0?w=1200&q=80&fit=crop&auto=format'),
('core-1','core',1,ARRAY['home']::text[],'/__l5e/assets-v1/05752656-af73-453e-ac38-086d5d8312cc/core-1.jpg','Jonathan Borba','Unsplash','https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80&fit=crop&auto=format'),
('core-2','core',2,ARRAY['home']::text[],'/__l5e/assets-v1/d15a797d-cc97-479f-a4eb-03d5e4c03103/core-2.jpg','Vitaly Gariev','Unsplash','https://images.unsplash.com/photo-1714646442330-9068099f5521?w=1200&q=80&fit=crop&auto=format'),
('core-3','core',3,ARRAY['home']::text[],'/__l5e/assets-v1/21b0ab38-4cb9-4a95-8e83-1238fecc6edf/core-3.jpg','Ginny Rose Stewart','Unsplash','https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=1200&q=80&fit=crop&auto=format'),
('full_body-1','full_body',1,ARRAY['home']::text[],'/__l5e/assets-v1/be818e08-726d-4f9f-b4d5-e45a5c5824ed/full_body-1.jpg','Lala Azizli','Unsplash','https://images.unsplash.com/photo-1691605085147-646fd8059b6d?w=1200&q=80&fit=crop&auto=format'),
('full_body-2','full_body',2,ARRAY['kettlebell','home']::text[],'/__l5e/assets-v1/6765e29d-47cb-446a-9f94-09d7083b6883/full_body-2.jpg','Ambitious Studio / Rick Barrett','Unsplash','https://images.unsplash.com/photo-1706029831387-fd8bc3d27d01?w=1200&q=80&fit=crop&auto=format'),
('full_body-3','full_body',3,ARRAY['gym','home']::text[],'/__l5e/assets-v1/01245835-bac6-417f-bada-706975cd2455/full_body-3.jpg','John Arano','Unsplash','https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1200&q=80&fit=crop&auto=format')
) AS v(key, focus, slot, equipment, url, credit, source, source_url);

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS cover_key text REFERENCES public.workout_cover_photos(key) ON DELETE SET NULL;
COMMENT ON COLUMN public.workouts.cover_key IS 'New version only: stable stock-photo cover for multi-exercise Discover cards. NULL for classic and single-exercise workouts; classic ignores it.';

CREATE OR REPLACE FUNCTION public.workout_cover_hash(_workout_id uuid) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE h bigint := 2166136261; i integer;
BEGIN
  FOR i IN 1..length(_workout_id::text) LOOP
    h := (((h # ascii(substr(_workout_id::text, i, 1))::bigint) * 16777619) % 4294967296);
  END LOOP;
  RETURN h;
END $$;

CREATE OR REPLACE FUNCTION public.workout_cover_key(_workout_id uuid, _exercises jsonb, _equipment text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  exercise_count integer;
  main_focus text;
  feel text;
  has_kettlebell boolean;
  has_band boolean;
  has_gym boolean;
  has_dumbbell boolean;
  exact_count integer;
  pool_count integer;
  chosen text;
BEGIN
  SELECT count(*) INTO exercise_count
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_exercises) = 'array' THEN _exercises ELSE '[]'::jsonb END) AS j(item)
  JOIN public.exercises e ON e.id = j.item->>'exerciseId';
  IF exercise_count <= 1 THEN RETURN NULL; END IF;

  WITH tags AS (
    SELECT j.ord AS item_order, d.ord AS muscle_order,
      CASE lower(replace(trim(d.muscle), '_', ' '))
        WHEN 'back' THEN 'back' WHEN 'lats' THEN 'back' WHEN 'upper back' THEN 'back'
        WHEN 'lower back' THEN 'back' WHEN 'traps' THEN 'back'
        WHEN 'chest' THEN 'chest' WHEN 'upper chest' THEN 'chest'
        WHEN 'shoulders' THEN 'shoulders' WHEN 'front delts' THEN 'shoulders'
        WHEN 'side delts' THEN 'shoulders' WHEN 'rear delts' THEN 'shoulders'
        WHEN 'biceps' THEN 'arms' WHEN 'triceps' THEN 'arms' WHEN 'forearms' THEN 'arms'
        WHEN 'quads' THEN 'legs' WHEN 'hamstrings' THEN 'legs' WHEN 'calves' THEN 'legs'
        WHEN 'legs' THEN 'legs' WHEN 'adductors' THEN 'legs' WHEN 'abductors' THEN 'legs'
        WHEN 'hip flexors' THEN 'legs'
        WHEN 'glutes' THEN 'glutes'
        WHEN 'abs' THEN 'core' WHEN 'core' THEN 'core' WHEN 'obliques' THEN 'core'
        WHEN 'full body' THEN 'full_body' WHEN 'fullbody' THEN 'full_body'
        ELSE NULL
      END AS focus
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_exercises) = 'array' THEN _exercises ELSE '[]'::jsonb END) WITH ORDINALITY AS j(item, ord)
    JOIN public.exercises e ON e.id = j.item->>'exerciseId'
    CROSS JOIN LATERAL unnest(
      CASE WHEN coalesce(array_length(e.muscles_detail, 1), 0) > 0 THEN e.muscles_detail ELSE e.primary_muscles END
    ) WITH ORDINALITY AS d(muscle, ord)
  ), ranked AS (
    SELECT focus, count(*) AS n, min(item_order * 1000 + muscle_order) AS first_seen
    FROM tags WHERE focus IS NOT NULL GROUP BY focus
  ), summary AS (
    SELECT count(*) AS focus_groups, max(n) AS top_n FROM ranked
  ), leaders AS (
    SELECT count(*) AS n FROM ranked r, summary s WHERE r.n = s.top_n
  )
  SELECT coalesce(
    CASE WHEN s.focus_groups >= 3 AND l.n >= 2 THEN 'full_body'
      ELSE (SELECT r.focus FROM ranked r ORDER BY r.n DESC, r.first_seen, r.focus LIMIT 1) END,
    'full_body'
  ) INTO main_focus
  FROM summary s, leaders l;

  SELECT
    bool_or(e.equipment = 'kettlebell'), bool_or(e.equipment = 'band'),
    bool_or(e.equipment IN ('barbell','cable','machine')), bool_or(e.equipment = 'dumbbell')
  INTO has_kettlebell, has_band, has_gym, has_dumbbell
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_exercises) = 'array' THEN _exercises ELSE '[]'::jsonb END) AS j(item)
  JOIN public.exercises e ON e.id = j.item->>'exerciseId';

  feel := CASE
    WHEN has_kettlebell AND NOT has_gym AND NOT has_dumbbell THEN 'kettlebell'
    WHEN has_band AND NOT has_gym AND NOT has_dumbbell AND NOT has_kettlebell THEN 'bands'
    WHEN has_gym OR _equipment = 'gym' THEN 'gym'
    WHEN has_dumbbell OR _equipment = 'dumbbells' THEN 'dumbbells'
    ELSE 'home'
  END;

  SELECT count(*) INTO exact_count FROM public.workout_cover_photos p
  WHERE p.focus = main_focus AND p.equipment @> ARRAY[feel];
  SELECT count(*) INTO pool_count FROM public.workout_cover_photos p
  WHERE p.focus = main_focus AND (exact_count = 0 OR p.equipment @> ARRAY[feel]);
  IF pool_count = 0 THEN RETURN NULL; END IF;

  WITH pool AS (
    SELECT p.key, row_number() OVER (ORDER BY p.key) AS rn
    FROM public.workout_cover_photos p
    WHERE p.focus = main_focus AND (exact_count = 0 OR p.equipment @> ARRAY[feel])
  )
  SELECT p.key INTO chosen FROM pool p
  WHERE p.rn = (public.workout_cover_hash(_workout_id) % pool_count + 1);
  RETURN chosen;
END $$;

CREATE OR REPLACE FUNCTION public.set_workout_cover_key() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.new_version_enabled AND p.app_version = 'new') THEN
    NEW.cover_key := public.workout_cover_key(NEW.id, NEW.exercises, NEW.equipment);
  ELSIF TG_OP = 'INSERT' THEN
    NEW.cover_key := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workouts_choose_cover
  BEFORE INSERT OR UPDATE OF exercises, equipment, user_id ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.set_workout_cover_key();

CREATE OR REPLACE FUNCTION public.refresh_member_workout_covers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.new_version_enabled AND NEW.app_version = 'new' THEN
    UPDATE public.workouts w SET cover_key = public.workout_cover_key(w.id, w.exercises, w.equipment)
    WHERE w.user_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_refresh_workout_covers
  AFTER UPDATE OF new_version_enabled, app_version ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.refresh_member_workout_covers();

UPDATE public.workouts w SET cover_key = public.workout_cover_key(w.id, w.exercises, w.equipment)
WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = w.user_id AND p.new_version_enabled AND p.app_version = 'new');

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
  SELECT l.code, l.name, l.exercises, coalesce(l.equipment, ow.equipment),
    CASE WHEN l.pactara_key IS NOT NULL THEN l.cover_url ELSE wc.url END,
    l.pactara_key IS NOT NULL, l.owner_id,
    CASE WHEN l.pactara_key IS NULL THEN pr.name END, l.created_at,
    (SELECT count(DISTINCT cp.user_id)::int FROM copies cp WHERE cp.listed_code = l.code),
    (SELECT count(DISTINCT cp.user_id)::int FROM copies cp WHERE cp.listed_code = l.code AND cp.created_at > now() - interval '7 days'),
    (SELECT count(DISTINCT ws.user_id)::int FROM public.workout_sessions ws
      WHERE ws.logged_at IS NOT NULL AND (ws.workout_id = l.workout_id OR ws.workout_id IN (SELECT cp.id FROM copies cp WHERE cp.listed_code = l.code))),
    mc.id, mc.name, mc.exercises
  FROM listed l
  LEFT JOIN public.workouts ow ON ow.id = l.workout_id
  LEFT JOIN public.workout_cover_photos wc ON wc.key = ow.cover_key AND l.pactara_key IS NULL AND jsonb_array_length(l.exercises) > 1
  LEFT JOIN public.profiles pr ON pr.id = l.owner_id
  LEFT JOIN LATERAL (SELECT cp.id, cp.name, cp.exercises FROM copies cp, me WHERE cp.listed_code = l.code AND cp.user_id = me.uid ORDER BY cp.created_at LIMIT 1) mc ON true
$$;

REVOKE ALL ON FUNCTION public.workout_cover_hash(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workout_cover_key(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_workout_cover_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_member_workout_covers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.discover_workout_feed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_workout_feed() TO authenticated;
