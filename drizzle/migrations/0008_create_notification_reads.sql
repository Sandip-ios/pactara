CREATE TABLE public.notification_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notification reads select" ON public.notification_reads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notification reads insert" ON public.notification_reads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notification reads update" ON public.notification_reads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notification reads delete" ON public.notification_reads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX notification_reads_user_idx ON public.notification_reads (user_id);
