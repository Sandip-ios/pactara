ALTER TABLE public.content_reports ALTER COLUMN group_id DROP NOT NULL;
COMMENT ON COLUMN public.content_reports.group_id IS 'Crew the report was made from. NULL only for new-version profile reports between members who share no crew. Historical IDs retained after owner account deletion; new references validated by trigger.';
CREATE OR REPLACE FUNCTION public.guard_retained_crew_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.group_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.group_id IS DISTINCT FROM OLD.group_id) THEN
  PERFORM 1 FROM public.groups WHERE id=NEW.group_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Crew reference does not exist' USING ERRCODE='23503'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE POLICY "Submit own profile report without crew" ON public.content_reports FOR INSERT TO authenticated
 WITH CHECK (reporter_id=auth.uid() AND reporter_id<>reported_user_id AND target_type='user' AND target_id IS NULL AND group_id IS NULL
  AND status='open' AND reviewed_at IS NULL AND public.is_new_version_user(auth.uid()));