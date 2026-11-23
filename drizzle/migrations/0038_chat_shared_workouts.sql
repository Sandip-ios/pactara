ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS shared_workout_code text REFERENCES public.shared_workouts(code);

CREATE INDEX IF NOT EXISTS group_messages_shared_workout_code_idx
  ON public.group_messages (group_id, shared_workout_code) WHERE shared_workout_code IS NOT NULL;

DROP POLICY IF EXISTS "Members can send messages" ON public.group_messages;
CREATE POLICY "Members can send messages"
  ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_group_member(group_id, auth.uid())
    AND (
      shared_workout_code IS NULL
      OR EXISTS (
        SELECT 1 FROM public.shared_workouts s
        WHERE s.code = group_messages.shared_workout_code
          AND s.owner_id = auth.uid()
      )
    )
  );