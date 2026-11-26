ALTER TABLE public.content_reports DROP CONSTRAINT content_reports_group_id_fkey;
ALTER TABLE public.crew_join_requests DROP CONSTRAINT crew_join_requests_group_id_fkey;
CREATE FUNCTION public.guard_retained_crew_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
  PERFORM 1 FROM public.groups WHERE id=NEW.group_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Crew reference does not exist' USING ERRCODE='23503'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_report_crew_reference BEFORE INSERT OR UPDATE ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.guard_retained_crew_reference();
CREATE TRIGGER validate_join_request_crew_reference BEFORE INSERT OR UPDATE ON public.crew_join_requests FOR EACH ROW EXECUTE FUNCTION public.guard_retained_crew_reference();
COMMENT ON COLUMN public.content_reports.group_id IS 'Historical crew ID retained unchanged after owner account deletion; new references validated by trigger.';
COMMENT ON COLUMN public.crew_join_requests.group_id IS 'Historical crew ID retained unchanged after owner account deletion; new references validated by trigger.';