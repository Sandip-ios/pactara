CREATE TABLE public.check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  note text,
  photo_url text,
  mood text,
  activity text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, checkin_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view check-ins in their groups"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can create their own check-ins in their groups"
  ON public.check_ins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can delete their own check-ins"
  ON public.check_ins FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX check_ins_group_date_idx ON public.check_ins (group_id, checkin_date);