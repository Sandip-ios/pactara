
ALTER TABLE public.earned_badges ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;

-- Backfill existing badge rows to the user's most-recently-joined group so the uniqueness upgrade is safe.
UPDATE public.earned_badges eb
SET group_id = gm.group_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, group_id
  FROM public.group_members
  ORDER BY user_id, joined_at DESC
) gm
WHERE eb.group_id IS NULL AND eb.user_id = gm.user_id;

-- Remove badges with no resolvable group (user no longer in any group).
DELETE FROM public.earned_badges WHERE group_id IS NULL;

ALTER TABLE public.earned_badges ALTER COLUMN group_id SET NOT NULL;

ALTER TABLE public.earned_badges DROP CONSTRAINT IF EXISTS earned_badges_user_id_streak_days_key;
ALTER TABLE public.earned_badges ADD CONSTRAINT earned_badges_user_group_streak_key UNIQUE (user_id, group_id, streak_days);

CREATE INDEX IF NOT EXISTS earned_badges_user_group_idx ON public.earned_badges(user_id, group_id);
