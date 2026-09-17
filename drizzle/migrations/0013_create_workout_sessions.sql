-- Live "working out now" accountability sessions.
CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.daily_posts(id) ON DELETE SET NULL,
  local_date date NOT NULL,
  commitment_text text,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  proof_completed boolean NOT NULL DEFAULT false,
  start_notification_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_workout_session_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'completed', 'ended_without_completion') THEN
    RAISE EXCEPTION 'Invalid workout session status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workout_sessions_validate_status
BEFORE INSERT OR UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_workout_session_status();

CREATE TRIGGER workout_sessions_touch_updated_at
BEFORE UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- At most one active session per user per commitment (group + local day).
CREATE UNIQUE INDEX workout_sessions_one_active
  ON public.workout_sessions (user_id, group_id, local_date)
  WHERE status = 'active';

CREATE INDEX workout_sessions_group_active
  ON public.workout_sessions (group_id, local_date, status);

GRANT SELECT, INSERT, UPDATE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view workout sessions"
  ON public.workout_sessions FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can start their own workout sessions"
  ON public.workout_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can update their own workout sessions"
  ON public.workout_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Lightweight encouragement on an active session.
CREATE TABLE public.workout_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.workout_cheers TO authenticated;
GRANT ALL ON public.workout_cheers TO service_role;

ALTER TABLE public.workout_cheers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view cheers"
  ON public.workout_cheers FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group members can cheer"
  ON public.workout_cheers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can remove their own cheers"
  ON public.workout_cheers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Independent notification switches.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS workout_start_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS workout_complete_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nudges_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_milestones_enabled boolean NOT NULL DEFAULT true;
