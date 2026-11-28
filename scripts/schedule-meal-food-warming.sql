-- PRODUCTION ACTIVATION ONLY, after accepting the draft and publishing the hook.
-- Not a migration: drafts cannot register managed HTTP schedules.
-- Uses a private database-generated token, never a public anon/publishable key.
-- Idempotent registration. No credentials are embedded in this file.
SELECT cron.unschedule('warm-meal-foods')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-meal-foods');

SELECT cron.schedule('warm-meal-foods', '*/15 * * * *', $job$
  SELECT net.http_post(
    url := 'https://pactara.lovable.app/api/public/hooks/warm-foods',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT token::text FROM public.meal_food_warm_control WHERE id)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);