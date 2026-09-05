SELECT cron.unschedule('streak-risk-reminder') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'streak-risk-reminder');

SELECT cron.schedule(
  'streak-risk-reminder',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pactara.lovable.app/api/public/hooks/streak-risk',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib3lrZ2ltZWdla2pmcGNyeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjA5NTQsImV4cCI6MjA5NzczNjk1NH0.6CvMepalQJ3pAM7NF-_VK_1cIwtsSU0Ia2afWo6rulo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);