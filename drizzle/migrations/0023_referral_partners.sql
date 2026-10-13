CREATE TABLE public.referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  dashboard_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  payout_per_member_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  event text NOT NULL,
  platform text NOT NULL,
  ip_hash text NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_events_lookup ON public.referral_events(ip_hash, event, created_at);
CREATE TABLE public.referral_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  user_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  linked_at timestamptz
);
GRANT ALL ON public.referral_partners, public.referral_events, public.referral_installs TO service_role;
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_installs ENABLE ROW LEVEL SECURITY;