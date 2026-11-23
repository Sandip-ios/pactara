ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS source_session_id uuid,
  ADD COLUMN IF NOT EXISTS source_user_id uuid,
  ADD COLUMN IF NOT EXISTS source_share_code text;

CREATE UNIQUE INDEX IF NOT EXISTS workouts_user_source_session_uidx
  ON public.workouts (user_id, source_session_id) WHERE source_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workouts_user_source_share_uidx
  ON public.workouts (user_id, source_share_code) WHERE source_share_code IS NOT NULL;

CREATE TABLE public.shared_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  workout_id uuid,
  name text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_workouts_code_format CHECK (code ~ '^[A-Za-z0-9]{8}$')
);

CREATE INDEX shared_workouts_owner_workout_idx ON public.shared_workouts (owner_id, workout_id, created_at DESC);

GRANT SELECT, INSERT ON public.shared_workouts TO authenticated;
GRANT ALL ON public.shared_workouts TO service_role;

ALTER TABLE public.shared_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their shared workouts"
  ON public.shared_workouts FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners share their own workouts"
  ON public.shared_workouts FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.workout_detail_for_check_in(_check_in_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'title', ws.title,
    'summary', ws.summary,
    'sessionId', ws.id,
    'userId', c.user_id,
    'checkinDate', c.checkin_date,
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
$function$;