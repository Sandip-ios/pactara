-- Build Muscle Day 4 (Full body): body map from its moves' library muscles (primary 2, secondary 1)
UPDATE public.plan_days d SET muscles = coalesce((
  SELECT jsonb_object_agg(x.r, x.lvl) FROM (
    SELECT r, max(lvl) AS lvl FROM jsonb_array_elements(d.moves) mv
    JOIN public.exercises e ON e.id = mv->>'exercise_id'
    CROSS JOIN LATERAL (SELECT unnest(e.primary_muscles) AS r, 2 AS lvl UNION ALL SELECT unnest(e.secondary_muscles), 1) u
    GROUP BY r) x), '{}'::jsonb)
FROM public.plans p
WHERE p.id = d.plan_id AND p.slug = 'build-muscle' AND d.day_number = 4 AND d.week_number IS NULL;