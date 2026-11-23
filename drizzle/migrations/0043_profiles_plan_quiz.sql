ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_quiz jsonb;
COMMENT ON COLUMN public.profiles.plan_quiz IS 'Find your plan answers: { goal, exp, gear: string[], days, completed_at }';