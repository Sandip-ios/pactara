ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'group';
ALTER TABLE public.groups ADD CONSTRAINT groups_kind_check CHECK (kind IN ('group','solo','partner'));

ALTER TABLE public.app_events ADD COLUMN IF NOT EXISTS properties jsonb;

CREATE TABLE public.partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1_id uuid NOT NULL,
  user_2_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_acceptance' CHECK (status IN ('searching','pending_acceptance','active','ended','rematch_requested','expired')),
  duration_days integer NOT NULL DEFAULT 90,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  user_1_accepted_at timestamptz,
  user_2_accepted_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid,
  ended_reason text,
  shared_streak integer NOT NULL DEFAULT 0,
  CHECK (user_1_id <> user_2_id)
);
CREATE INDEX partnerships_user_1_idx ON public.partnerships(user_1_id, status);
CREATE INDEX partnerships_user_2_idx ON public.partnerships(user_2_id, status);
GRANT SELECT ON public.partnerships TO authenticated;
GRANT ALL ON public.partnerships TO service_role;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners can view their partnerships" ON public.partnerships
  FOR SELECT TO authenticated USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

CREATE TABLE public.partner_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','matched','removed')),
  goal text,
  solo_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  recent_activity_at timestamptz NOT NULL DEFAULT now(),
  reliability_score_internal numeric NOT NULL DEFAULT 0,
  released_count integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX partner_queue_user_uidx ON public.partner_queue(user_id);
CREATE INDEX partner_queue_waiting_idx ON public.partner_queue(status, recent_activity_at DESC);
GRANT ALL ON public.partner_queue TO service_role;
ALTER TABLE public.partner_queue ENABLE ROW LEVEL SECURITY;