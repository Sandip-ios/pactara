CREATE TABLE public.account_deletions (
  user_id uuid PRIMARY KEY,
  email text,
  name text,
  source text NOT NULL DEFAULT 'unknown',
  deleted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_deletions TO service_role;
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.log_profile_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.account_deletions (user_id, email, name, source)
  VALUES (OLD.id, (SELECT email FROM auth.users WHERE id = OLD.id), OLD.name, 'other')
  ON CONFLICT (user_id) DO UPDATE
    SET name = COALESCE(public.account_deletions.name, EXCLUDED.name),
        email = COALESCE(public.account_deletions.email, EXCLUDED.email);
  RETURN OLD;
END $$;

CREATE TRIGGER profiles_log_deletion
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_deletion();