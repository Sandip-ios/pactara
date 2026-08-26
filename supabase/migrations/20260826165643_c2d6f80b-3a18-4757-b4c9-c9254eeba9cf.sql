CREATE TABLE public.deferred_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  ip_hash text NOT NULL,
  platform text NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deferred_invites_lookup_idx ON public.deferred_invites (ip_hash, platform, created_at DESC);

GRANT ALL ON public.deferred_invites TO service_role;

ALTER TABLE public.deferred_invites ENABLE ROW LEVEL SECURITY;