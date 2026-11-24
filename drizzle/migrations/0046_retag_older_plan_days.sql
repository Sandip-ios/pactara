UPDATE public.plan_days d SET muscles = coalesce(d.muscles,'{}'::jsonb) || v.patch
FROM public.plans p, (VALUES
 ('build-muscle',1,'{"traps":1}'::jsonb),
 ('build-muscle',2,'{"back":1,"forearms":1}'::jsonb),
 ('build-muscle',3,'{"shoulders":2}'::jsonb),
 ('build-muscle',5,'{"shoulders":1,"forearms":1}'::jsonb),
 ('lose-fat',1,'{"traps":1}'::jsonb),
 ('lose-fat',3,'{"back":1,"forearms":1}'::jsonb),
 ('lose-fat',4,'{"quads":2,"calves":2}'::jsonb),
 ('glute-builder',1,'{"back":1}'::jsonb),
 ('home-no-equipment',1,'{"traps":1,"hamstrings":1}'::jsonb),
 ('home-no-equipment',2,'{"calves":0}'::jsonb)
) AS v(slug, day, patch)
WHERE p.id = d.plan_id AND p.slug = v.slug AND d.day_number = v.day;