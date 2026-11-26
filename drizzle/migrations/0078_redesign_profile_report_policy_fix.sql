CREATE OR REPLACE FUNCTION public.caller_on_new_version() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND public.is_new_version_user(auth.uid()) $$;
REVOKE ALL ON FUNCTION public.caller_on_new_version() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.caller_on_new_version() TO authenticated;
DROP POLICY "Submit own profile report without crew" ON public.content_reports;
CREATE POLICY "Submit own profile report without crew" ON public.content_reports FOR INSERT TO authenticated
 WITH CHECK (reporter_id=auth.uid() AND reporter_id<>reported_user_id AND target_type='user' AND target_id IS NULL AND group_id IS NULL
  AND status='open' AND reviewed_at IS NULL AND public.caller_on_new_version());