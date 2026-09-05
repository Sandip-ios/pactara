CREATE TABLE IF NOT EXISTS public.user_badge_counts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_badge_counts TO authenticated;
GRANT ALL ON public.user_badge_counts TO service_role;

ALTER TABLE public.user_badge_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own badge count" ON public.user_badge_counts;
CREATE POLICY "Users read own badge count"
ON public.user_badge_counts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_badge_counts(_user_ids uuid[])
RETURNS TABLE (user_id uuid, count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_badge_counts (user_id, count, updated_at)
  SELECT u, 1, now() FROM unnest(_user_ids) AS u
  ON CONFLICT (user_id) DO UPDATE
    SET count = public.user_badge_counts.count + 1,
        updated_at = now()
  RETURNING public.user_badge_counts.user_id, public.user_badge_counts.count;
$$;

REVOKE ALL ON FUNCTION public.increment_badge_counts(uuid[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_badge_counts(uuid[]) TO service_role;