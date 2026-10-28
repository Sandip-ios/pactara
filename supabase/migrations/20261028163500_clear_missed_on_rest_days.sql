UPDATE public.daily_posts d
SET morning_missed = false, check_in_missed = false
FROM public.streak_freezes_used f
WHERE f.user_id = d.user_id AND f.group_id = d.group_id AND f.freeze_date = d.local_date
  AND d.check_in_id IS NULL AND (d.morning_missed OR d.check_in_missed);
