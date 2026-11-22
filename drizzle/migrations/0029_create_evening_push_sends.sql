CREATE TABLE public.evening_push_sends (
  user_id uuid NOT NULL,
  local_date date NOT NULL,
  hour smallint NOT NULL CHECK (hour IN (20, 21)),
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
  group_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_date)
);

COMMENT ON TABLE public.evening_push_sends IS 'One evening push (8 PM reminder or 9 PM streak-at-risk) per member per local day. Written only by the hourly jobs.';

GRANT ALL ON public.evening_push_sends TO service_role;

ALTER TABLE public.evening_push_sends ENABLE ROW LEVEL SECURITY;

-- Atomically claims tonight's single evening push for a member. Returns true
-- when this caller may send: no row yet, or a later hour (9 PM) taking over an
-- earlier push (8 PM) that failed to deliver. A second or overlapping run gets false.
CREATE OR REPLACE FUNCTION public.claim_evening_push(_user_id uuid, _local_date date, _hour smallint)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    INSERT INTO public.evening_push_sends AS s (user_id, local_date, hour, status)
    VALUES (_user_id, _local_date, _hour, 'sending')
    ON CONFLICT (user_id, local_date) DO UPDATE
      SET hour = EXCLUDED.hour, status = 'sending', group_ids = '{}', updated_at = now()
      WHERE s.status = 'failed' AND EXCLUDED.hour > s.hour
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$;

REVOKE ALL ON FUNCTION public.claim_evening_push(uuid, date, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_evening_push(uuid, date, smallint) TO service_role;