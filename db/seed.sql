INSERT INTO public.groups (id, name, owner_id, duration_days, start_date, frequency, days_per_week)
SELECT 'b39163e7-1e9b-45ec-8ea2-5c721109aa32', 'QA Crew 2', id, 30, CURRENT_DATE, 'daily', 7
FROM auth.users WHERE email = 'redesign-qa@pactara.test'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id)
SELECT 'b39163e7-1e9b-45ec-8ea2-5c721109aa32', id
FROM auth.users WHERE email = 'redesign-qa@pactara.test'
ON CONFLICT (group_id, user_id) DO NOTHING;