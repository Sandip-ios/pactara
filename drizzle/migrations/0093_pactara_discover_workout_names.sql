CREATE OR REPLACE FUNCTION public.pactara_workout_name(_key text, _fallback text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _key
    WHEN '008eb68c0e5c67c2871b1e6d66b5943d' THEN 'Barbell squat + bench'
    WHEN 'c7a6a3e78f04d37b806efb88ede43684' THEN 'Barbell squat + deadlift'
    WHEN '37ce9ba4818ecbcca72eddab367e37bd' THEN 'Squat-focused legs'
    WHEN '4419ffbe32daae10169ff1bb33959e1e' THEN 'Deadlift-focused legs'
    WHEN 'fe0e0afb94e9295b805b3e31157b50bb' THEN 'Bench press upper body'
    WHEN '033b5b7a2ce3cf559be42c026ff6705c' THEN 'Incline press upper body'
    WHEN 'a5af985459267d96f48ef61b6cd02d66' THEN 'Machine upper body'
    WHEN 'bcde5003be2cc9baa1992230c6305d7f' THEN 'Machine full body'
    WHEN 'f038382936e9ad7a4f07acbb50af47cf' THEN 'Machine shoulders + legs'
    WHEN '601e134a2f57f746ad8a89319b42a928' THEN 'Dumbbell press + squat'
    WHEN 'c14965d73c11d71f2542962c420c2571' THEN 'Dumbbell hinge + press'
    WHEN '26ef8dd31835e4503da4aee44813e1e2' THEN 'Dumbbell split squat day'
    WHEN '2af517e862f4c323bde9d8cb7816d4e8' THEN 'Dumbbell carry day'
    WHEN '95b604bd3ffca3f9cba1f8f717f3a76f' THEN 'Dumbbell legs'
    WHEN '39922b8ede5b24fb36c50d05925189e9' THEN 'Dumbbell upper body'
    WHEN 'f31bd7ce2d29c32c9e5182549e3c1e8e' THEN 'Squat + row starter'
    WHEN 'eae10fe1b092bb958cfbb73583920239' THEN 'Hinge + press starter'
    WHEN 'e89287d904bc9980868ec09fc3b54a41' THEN 'Bodyweight full body'
    WHEN 'caadcafafa08167bcf40067f3963d31f' THEN 'Advanced bodyweight'
    WHEN 'b1bbbe824cbfcff19606b5cee345ca32' THEN 'Bodyweight legs'
    WHEN 'e3773fc366a924cd3f6a689f3b7f9044' THEN 'Lower body at home'
    WHEN '5381d6f7914cc04f7d90f1ffc92d7afa' THEN 'Bodyweight upper body'
    WHEN '5fdf98015e9366fdc2b715a4824bd911' THEN 'Bodyweight push'
    WHEN '464fcd7e7d22c46e1200293322f0d900' THEN 'Core basics'
    WHEN '935dcb977baadbc8e936e6c39589425e' THEN 'Core burner'
    WHEN '6e8226a14dfea486705d71acd1267cd3' THEN 'Back stretch'
    WHEN '40285904198e90cc1966f6c1cbfb9f8d' THEN 'Hip stretch'
    WHEN '31f9f629711c8c7204ff6dcd25c436b6' THEN 'Full body stretch'
    ELSE _fallback
  END
$$;
REVOKE ALL ON FUNCTION public.pactara_workout_name(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pactara_workout_name(text, text) TO service_role;

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
    SELECT public.random_share_code(), public.pactara_author_id(), NULL, left(public.pactara_workout_name(u.k, u.title), 60), u.exercises, true, u.k, u.cover_url,
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