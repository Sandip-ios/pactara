SELECT cron.unschedule('daily-checkin-reminder') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-checkin-reminder');

SELECT cron.schedule(
  'daily-checkin-reminder',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pactara.lovable.app/api/public/hooks/daily-reminder',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib3lrZ2ltZWdla2pmcGNyeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjA5NTQsImV4cCI6MjA5NzczNjk1NH0.6CvMepalQJ3pAM7NF-_VK_1cIwtsSU0Ia2afWo6rulo"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);