CREATE OR REPLACE FUNCTION public.get_my_logger_check_tip_seen()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.seen_logger_check_tip_at FROM public.profiles p WHERE p.id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_logger_check_tip_seen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_logger_check_tip_seen() TO authenticated;