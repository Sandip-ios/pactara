ALTER TABLE public.evening_push_sends
  ADD COLUMN source text CHECK (source IN ('last_call', 'streak_risk', 'daily_reminder'));
COMMENT ON COLUMN public.evening_push_sends.source IS 'Which evening push used the night: 8 PM last call, 9 PM streak at risk, or a personal daily reminder set between 8:00 and 9:59 PM.';