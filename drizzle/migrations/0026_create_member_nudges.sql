CREATE TABLE public.member_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  nudger_id uuid NOT NULL,
  target_id uuid NOT NULL,
  local_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_nudges_once_per_day UNIQUE (group_id, nudger_id, target_id, local_date)
);

GRANT SELECT, INSERT ON public.member_nudges TO authenticated;
GRANT ALL ON public.member_nudges TO service_role;

ALTER TABLE public.member_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see nudges they sent"
ON public.member_nudges FOR SELECT TO authenticated
USING (auth.uid() = nudger_id);

CREATE POLICY "Members record their own nudges to groupmates"
ON public.member_nudges FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = nudger_id
  AND nudger_id <> target_id
  AND public.is_group_member(group_id, auth.uid())
  AND public.is_group_member(group_id, target_id)
);

CREATE INDEX member_nudges_nudger_day_idx ON public.member_nudges (nudger_id, local_date);