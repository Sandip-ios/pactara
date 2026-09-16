-- Reminder crons read notification_preferences directly, so users without a
-- row silently receive nothing. Backfill defaults for everyone and keep new
-- profiles covered automatically.
INSERT INTO public.notification_preferences (user_id)
SELECT p.id FROM public.profiles p
LEFT JOIN public.notification_preferences np ON np.user_id = p.id
WHERE np.user_id IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_notification_preferences ON public.profiles;
CREATE TRIGGER profiles_ensure_notification_preferences
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_notification_preferences();