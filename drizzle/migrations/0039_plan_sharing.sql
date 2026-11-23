CREATE TABLE public.shared_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9]{8}$'),
  owner_id uuid NOT NULL,
  plan_slug text NOT NULL REFERENCES public.plans(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, plan_slug)
);

GRANT SELECT, INSERT ON public.shared_plans TO authenticated;
GRANT ALL ON public.shared_plans TO service_role;

ALTER TABLE public.shared_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their plan links"
  ON public.shared_plans FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners make their own plan links"
  ON public.shared_plans FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS shared_plan_slug text REFERENCES public.plans(slug) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS group_messages_shared_plan_once_idx
  ON public.group_messages (group_id, user_id, shared_plan_slug) WHERE shared_plan_slug IS NOT NULL;

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
    AND (
      shared_plan_slug IS NULL
      OR EXISTS (
        SELECT 1 FROM public.plans p
        WHERE p.slug = group_messages.shared_plan_slug
          AND p.is_published
      )
    )
  );