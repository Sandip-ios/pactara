ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS personal_goal text;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS personal_goal_set_at timestamptz;