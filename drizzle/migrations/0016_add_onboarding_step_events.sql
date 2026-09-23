CREATE TABLE public.onboarding_step_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL,
  user_id uuid,
  path text NOT NULL CHECK (path IN ('creator', 'invitee')),
  step text NOT NULL CHECK (step IN ('name', 'email', 'photo', 'consistency', 'duration', 'group_name', 'social_proof', 'password', 'account_created', 'invite_friends', 'notifications', 'greeting', 'paywall', 'personal_goal', 'pact')),
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (journey_id, step)
);

GRANT ALL ON public.onboarding_step_events TO service_role;

ALTER TABLE public.onboarding_step_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX onboarding_step_events_occurred_at_idx ON public.onboarding_step_events (occurred_at DESC);
CREATE INDEX onboarding_step_events_path_step_idx ON public.onboarding_step_events (path, step);
CREATE INDEX onboarding_step_events_user_id_idx ON public.onboarding_step_events (user_id) WHERE user_id IS NOT NULL;