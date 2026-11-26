CREATE OR REPLACE FUNCTION public.is_new_version_user(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id AND new_version_enabled AND app_version='new') $$;
REVOKE ALL ON FUNCTION public.is_new_version_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_new_version_user(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.normalize_crew_discovery() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.ended_at IS NOT NULL THEN NEW.discoverable:=false; END IF;
 IF TG_OP='INSERT' AND NEW.discoverable AND NOT public.is_new_version_user(NEW.owner_id) THEN NEW.discoverable:=false; END IF;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.request_crew_join(_group_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE g public.groups; r public.crew_join_requests; u uuid:=auth.uid(); BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in to request a crew'; END IF;
 SELECT * INTO g FROM public.groups WHERE id=_group_id FOR UPDATE;
 IF NOT FOUND OR g.ended_at IS NOT NULL OR NOT g.discoverable OR NOT public.is_new_version_user(g.owner_id) OR EXISTS(SELECT 1 FROM public.user_blocks WHERE (blocker_id=g.owner_id AND blocked_id=u) OR (blocker_id=u AND blocked_id=g.owner_id)) THEN RAISE EXCEPTION 'This crew is not available'; END IF;
 IF EXISTS(SELECT 1 FROM public.group_members WHERE group_id=g.id AND user_id=u) THEN RAISE EXCEPTION 'You are already in this crew'; END IF;
 UPDATE public.crew_join_requests SET status='expired',decided_at=now() WHERE group_id=g.id AND requester_id=u AND status='pending' AND created_at<=now()-interval '14 days';
 SELECT * INTO r FROM public.crew_join_requests WHERE group_id=g.id AND requester_id=u AND status='pending';
 IF FOUND THEN RETURN jsonb_build_object('id',r.id,'changed',false,'owner_id',g.owner_id); END IF;
 IF (SELECT count(*) FROM public.group_members WHERE group_id=g.id)>=8 THEN RAISE EXCEPTION 'Crew is full'; END IF;
 INSERT INTO public.crew_join_requests(group_id,requester_id) VALUES(g.id,u) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'changed',true,'owner_id',g.owner_id); END $$;