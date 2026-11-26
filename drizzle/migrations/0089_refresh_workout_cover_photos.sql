UPDATE public.workout_cover_photos AS c
SET url = v.url, equipment = v.equipment, credit = v.credit, source = v.source, source_url = v.source_url
FROM (VALUES
  ('arms-3', '/__l5e/assets-v1/6ef8a547-d81b-4da4-ba0a-8972d489c917/arms-3.jpg', ARRAY['dumbbells','gym']::text[], 'Luke Witter', 'Unsplash', 'https://images.unsplash.com/photo-1641337221253-fdc7237f6b61?w=1200&q=80&fit=crop&auto=format'),
  ('chest-3', '/__l5e/assets-v1/15ce1bbb-884c-43b8-9bcd-57d3230a5886/chest-3.jpg', ARRAY['gym']::text[], 'Andrea Piacquadio', 'Pexels', 'https://www.pexels.com/photo/strong-sportsman-doing-bench-press-during-workout-in-modern-gym-3837743/'),
  ('full_body-1', '/__l5e/assets-v1/958e293b-31f1-4902-80be-f40395769d12/full_body-1.jpg', ARRAY['gym']::text[], 'Leon Mart', 'Pexels', 'https://www.pexels.com/photo/man-pushing-cart-with-weight-plates-1552104/'),
  ('glutes-2', '/__l5e/assets-v1/2ffaf007-22f7-4119-80dc-244ddc412e77/glutes-2.jpg', ARRAY['bands','home']::text[], 'Gabriel Alenius', 'Unsplash', 'https://images.unsplash.com/photo-1552226351-1ac7863af926?w=1200&q=80&fit=crop&auto=format'),
  ('glutes-3', '/__l5e/assets-v1/d53bfd80-14fe-45a5-b1cc-0715bd97c1d5/glutes-3.jpg', ARRAY['gym']::text[], 'RDNE Stock project', 'Pexels', 'https://www.pexels.com/photo/healthy-woman-women-fitness-6539861/'),
  ('legs-2', '/__l5e/assets-v1/0c16871c-b8af-430d-b31b-03289e3055d8/legs-2.jpg', ARRAY['dumbbells','gym','home']::text[], '@marcuschanmedia', 'Pexels', 'https://www.pexels.com/photo/man-performing-dumbbell-lunges-in-gym-29825222/'),
  ('shoulders-3', '/__l5e/assets-v1/a88e2e45-605a-4e4d-b908-869e669a92ba/shoulders-3.jpg', ARRAY['dumbbells','gym']::text[], 'Alesia Kozik', 'Pexels', 'https://www.pexels.com/photo/a-man-doing-a-dumbbell-shoulder-press-7289236/')
) AS v(key, url, equipment, credit, source, source_url)
WHERE c.key = v.key;