-- App open / lifecycle events for founder analytics
CREATE TABLE IF NOT EXISTS public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  app_version text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_events_occurred_at_idx ON public.app_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS app_events_user_idx ON public.app_events (user_id, occurred_at DESC);

GRANT INSERT ON public.app_events TO authenticated;
GRANT ALL ON public.app_events TO service_role;

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert their own app events" ON public.app_events;
CREATE POLICY "Users insert their own app events"
  ON public.app_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Cached App Store Connect daily numbers
CREATE TABLE IF NOT EXISTS public.app_store_daily (
  report_date date PRIMARY KEY,
  units integer NOT NULL DEFAULT 0,
  updates integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_store_daily TO service_role;
ALTER TABLE public.app_store_daily ENABLE ROW LEVEL SECURITY;
-- no client policies: service role only

-- Security hardening: profiles readable only by self and groupmates
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by self and groupmates"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_group_with(auth.uid(), id));

-- Security hardening: avatar files readable only by owner and groupmates
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars readable by owner and groupmates"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      owner_id = (select auth.uid()::text)
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.shares_group_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );