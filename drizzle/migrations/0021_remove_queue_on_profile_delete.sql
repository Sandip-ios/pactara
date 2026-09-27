CREATE OR REPLACE FUNCTION public.log_profile_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.account_deletions (user_id, email, name, source)
  VALUES (OLD.id, (SELECT email FROM auth.users WHERE id = OLD.id), OLD.name, 'other')
  ON CONFLICT (user_id) DO UPDATE
    SET name = COALESCE(public.account_deletions.name, EXCLUDED.name),
        email = COALESCE(public.account_deletions.email, EXCLUDED.email);
  UPDATE public.partner_queue SET status = 'removed' WHERE user_id = OLD.id;
  RETURN OLD;
END $$;

UPDATE public.partner_queue q SET status = 'removed'
WHERE status IN ('waiting','matched') AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = q.user_id);