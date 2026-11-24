UPDATE public.plan_days d SET muscles = '{"chest":2,"back":2,"glutes":2,"quads":2,"shoulders":1,"traps":1,"biceps":1,"triceps":1,"forearms":1,"abs":1,"hamstrings":1,"calves":0}'::jsonb
FROM public.plans p
WHERE p.id = d.plan_id AND p.slug = 'build-muscle' AND d.day_number = 4 AND d.week_number IS NULL;