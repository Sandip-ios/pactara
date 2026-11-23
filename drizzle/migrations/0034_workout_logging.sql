CREATE TABLE public.exercises (
  id text PRIMARY KEY DEFAULT ('custom-' || gen_random_uuid()::text),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  primary_muscles text[] NOT NULL DEFAULT '{}',
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  equipment text NOT NULL DEFAULT 'other' CHECK (equipment IN ('dumbbell','barbell','cable','machine','bodyweight','band','kettlebell','other')),
  category text NOT NULL DEFAULT 'strength',
  log_type text NOT NULL DEFAULT 'reps' CHECK (log_type IN ('reps','timed')),
  instructions text[] NOT NULL DEFAULT '{}',
  image_start text,
  image_peak text,
  owner_id uuid,
  source text NOT NULL DEFAULT 'custom' CHECK (source IN ('repdb','custom')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercises_owner_idx ON public.exercises (owner_id) WHERE owner_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Library and own exercises are readable" ON public.exercises
  FOR SELECT TO authenticated USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "Members add their own exercises" ON public.exercises
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND source = 'custom');
CREATE POLICY "Members edit their own exercises" ON public.exercises
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND source = 'custom');
CREATE POLICY "Members delete their own exercises" ON public.exercises
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workouts_user_idx ON public.workouts (user_id, last_done_at DESC NULLS LAST);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own workouts readable" ON public.workouts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own workouts insert" ON public.workouts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own workouts update" ON public.workouts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own workouts delete" ON public.workouts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER workouts_touch_updated_at BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.workout_sessions
  ADD COLUMN workout_id uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  ADD COLUMN title text,
  ADD COLUMN logged_at timestamptz,
  ADD COLUMN summary jsonb,
  ADD COLUMN check_in_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX workout_sessions_check_in_ids_idx ON public.workout_sessions USING gin (check_in_ids);

CREATE TABLE public.workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  exercise_id text NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  set_no integer NOT NULL,
  weight numeric(7,2),
  unit text NOT NULL DEFAULT 'lb' CHECK (unit IN ('lb','kg')),
  reps integer CHECK (reps IS NULL OR reps BETWEEN 0 AND 1000),
  seconds integer CHECK (seconds IS NULL OR seconds BETWEEN 0 AND 86400),
  is_pr boolean NOT NULL DEFAULT false,
  local_date date NOT NULL,
  done_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_set_logs_user_exercise_idx ON public.workout_set_logs (user_id, exercise_id, done_at DESC);
CREATE INDEX workout_set_logs_session_idx ON public.workout_set_logs (session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_set_logs TO authenticated;
GRANT ALL ON public.workout_set_logs TO service_role;
ALTER TABLE public.workout_set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sets readable" ON public.workout_set_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own sets insert" ON public.workout_set_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own sets update" ON public.workout_set_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own sets delete" ON public.workout_set_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.profiles
  ADD COLUMN weight_unit text NOT NULL DEFAULT 'lb' CHECK (weight_unit IN ('lb','kg'));

-- Feed: the workout summary attached to check-ins the caller can see.
CREATE OR REPLACE FUNCTION public.workout_summaries_for_check_ins(_check_in_ids uuid[])
RETURNS TABLE(check_in_id uuid, session_id uuid, title text, summary jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, ws.id, ws.title, ws.summary
  FROM public.check_ins c
  JOIN public.workout_sessions ws
    ON ws.check_in_ids @> ARRAY[c.id] AND ws.user_id = c.user_id
  WHERE c.id = ANY(_check_in_ids)
    AND ws.logged_at IS NOT NULL
    AND public.is_group_member(c.group_id, auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.workout_summaries_for_check_ins(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workout_summaries_for_check_ins(uuid[]) TO authenticated;

-- Read-only sheet: exercises and sets of the workout on one visible check-in.
CREATE OR REPLACE FUNCTION public.workout_detail_for_check_in(_check_in_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', ws.title,
    'summary', ws.summary,
    'sets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'exerciseId', l.exercise_id, 'name', e.name, 'imageStart', e.image_start,
        'logType', e.log_type, 'equipment', e.equipment,
        'position', l.position, 'setNo', l.set_no, 'weight', l.weight, 'unit', l.unit,
        'reps', l.reps, 'seconds', l.seconds, 'isPr', l.is_pr
      ) ORDER BY l.position, l.set_no)
      FROM public.workout_set_logs l JOIN public.exercises e ON e.id = l.exercise_id
      WHERE l.session_id = ws.id
    ), '[]'::jsonb)
  )
  FROM public.check_ins c
  JOIN public.workout_sessions ws
    ON ws.check_in_ids @> ARRAY[c.id] AND ws.user_id = c.user_id
  WHERE c.id = _check_in_id
    AND ws.logged_at IS NOT NULL
    AND public.is_group_member(c.group_id, auth.uid())
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.workout_detail_for_check_in(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workout_detail_for_check_in(uuid) TO authenticated;