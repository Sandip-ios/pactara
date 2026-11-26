ALTER TABLE public.groups ADD COLUMN discoverable boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.normalize_crew_discovery() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.ended_at IS NOT NULL THEN NEW.discoverable:=false; END IF; RETURN NEW; END $$;
CREATE TRIGGER normalize_crew_discovery BEFORE INSERT OR UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.normalize_crew_discovery();
CREATE TABLE public.crew_join_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES public.groups(id), requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','cancelled','expired')), created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, goal_prompt_seen_at timestamptz);
GRANT SELECT ON public.crew_join_requests TO authenticated;
GRANT UPDATE(status) ON public.crew_join_requests TO authenticated;
GRANT ALL ON public.crew_join_requests TO service_role;
ALTER TABLE public.crew_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requester or current owner reads requests" ON public.crew_join_requests FOR SELECT TO authenticated USING (requester_id=auth.uid() OR EXISTS(SELECT 1 FROM public.groups g WHERE g.id=group_id AND g.owner_id=auth.uid()));
CREATE POLICY "Requester cancels pending request" ON public.crew_join_requests FOR UPDATE TO authenticated USING(requester_id=auth.uid() AND status='pending' AND created_at>now()-interval '14 days') WITH CHECK(requester_id=auth.uid() AND status='cancelled');
CREATE UNIQUE INDEX crew_join_one_pending ON public.crew_join_requests(group_id,requester_id) WHERE status='pending';
CREATE INDEX crew_join_owner_queue ON public.crew_join_requests(group_id,status,created_at);
CREATE FUNCTION public.request_crew_join(_group_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE g public.groups; r public.crew_join_requests; u uuid:=auth.uid(); BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in to request a crew'; END IF;
 SELECT * INTO g FROM public.groups WHERE id=_group_id FOR UPDATE;
 IF NOT FOUND OR g.ended_at IS NOT NULL OR NOT g.discoverable OR EXISTS(SELECT 1 FROM public.user_blocks WHERE (blocker_id=g.owner_id AND blocked_id=u) OR (blocker_id=u AND blocked_id=g.owner_id)) THEN RAISE EXCEPTION 'This crew is not available'; END IF;
 IF EXISTS(SELECT 1 FROM public.group_members WHERE group_id=g.id AND user_id=u) THEN RAISE EXCEPTION 'You are already in this crew'; END IF;
 UPDATE public.crew_join_requests SET status='expired',decided_at=now() WHERE group_id=g.id AND requester_id=u AND status='pending' AND created_at<=now()-interval '14 days';
 SELECT * INTO r FROM public.crew_join_requests WHERE group_id=g.id AND requester_id=u AND status='pending';
 IF FOUND THEN RETURN jsonb_build_object('id',r.id,'changed',false,'owner_id',g.owner_id); END IF;
 IF (SELECT count(*) FROM public.group_members WHERE group_id=g.id)>=8 THEN RAISE EXCEPTION 'Crew is full'; END IF;
 INSERT INTO public.crew_join_requests(group_id,requester_id) VALUES(g.id,u) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'changed',true,'owner_id',g.owner_id); END $$;
REVOKE ALL ON FUNCTION public.request_crew_join(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_crew_join(uuid) TO authenticated,service_role;
CREATE FUNCTION public.decide_crew_join_request(_request_id uuid,_decision text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE g public.groups; r public.crew_join_requests; gid uuid; u uuid:=auth.uid(); BEGIN
 IF u IS NULL OR _decision NOT IN ('approved','declined') THEN RAISE EXCEPTION 'Invalid request decision'; END IF;
 SELECT group_id INTO gid FROM public.crew_join_requests WHERE id=_request_id;
 SELECT * INTO g FROM public.groups WHERE id=gid FOR UPDATE;
 IF NOT FOUND OR g.owner_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'Only the person who runs this crew can decide'; END IF;
 SELECT * INTO r FROM public.crew_join_requests WHERE id=_request_id FOR UPDATE;
 IF r.status=_decision THEN RETURN jsonb_build_object('status',r.status,'changed',false,'group_id',g.id,'requester_id',r.requester_id); END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'This request is no longer pending'; END IF;
 IF r.created_at<=now()-interval '14 days' THEN UPDATE public.crew_join_requests SET status='expired',decided_at=now() WHERE id=r.id; RETURN jsonb_build_object('status','expired','changed',false); END IF;
 IF g.ended_at IS NOT NULL THEN RAISE EXCEPTION 'This crew has ended'; END IF;
 IF _decision='approved' THEN
  IF EXISTS(SELECT 1 FROM public.user_blocks WHERE (blocker_id=g.owner_id AND blocked_id=r.requester_id) OR (blocker_id=r.requester_id AND blocked_id=g.owner_id)) THEN RAISE EXCEPTION 'This request is no longer available'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=g.id AND user_id=r.requester_id) THEN
   IF (SELECT count(*) FROM public.group_members WHERE group_id=g.id)>=8 THEN RAISE EXCEPTION 'Crew is full'; END IF;
   INSERT INTO public.group_members(group_id,user_id) VALUES(g.id,r.requester_id) ON CONFLICT(group_id,user_id) DO NOTHING;
  END IF;
 END IF;
 UPDATE public.crew_join_requests SET status=_decision,decided_at=now(),decided_by=u WHERE id=r.id;
 RETURN jsonb_build_object('status',_decision,'changed',true,'group_id',g.id,'requester_id',r.requester_id);
END $$;
REVOKE ALL ON FUNCTION public.decide_crew_join_request(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_crew_join_request(uuid,text) TO authenticated,service_role;
CREATE FUNCTION public.cancel_crew_join_request(_request_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.crew_join_requests; u uuid:=auth.uid(); new_status text; BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 SELECT * INTO r FROM public.crew_join_requests WHERE id=_request_id AND requester_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF r.status='cancelled' THEN RETURN r.status; END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'This request is no longer pending'; END IF;
 new_status:=CASE WHEN r.created_at<=now()-interval '14 days' THEN 'expired' ELSE 'cancelled' END;
 UPDATE public.crew_join_requests SET status=new_status,decided_at=now(),decided_by=u WHERE id=r.id;
 RETURN new_status; END $$;
REVOKE ALL ON FUNCTION public.cancel_crew_join_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_crew_join_request(uuid) TO authenticated,service_role;
CREATE FUNCTION public.complete_crew_join_goal(_group_id uuid,_goal text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); BEGIN
 IF u IS NULL OR length(btrim(coalesce(_goal,'')))>120 THEN RAISE EXCEPTION 'Keep your goal to 120 characters'; END IF;
 PERFORM 1 FROM public.groups WHERE id=_group_id AND ended_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=_group_id AND user_id=u) THEN RAISE EXCEPTION 'This crew is no longer available'; END IF;
 PERFORM 1 FROM public.crew_join_requests WHERE group_id=_group_id AND requester_id=u AND status='approved' AND goal_prompt_seen_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF nullif(btrim(_goal),'') IS NOT NULL THEN UPDATE public.group_members SET personal_goal=btrim(_goal),personal_goal_set_at=now() WHERE group_id=_group_id AND user_id=u; END IF;
 UPDATE public.crew_join_requests SET goal_prompt_seen_at=now() WHERE group_id=_group_id AND requester_id=u AND status='approved' AND goal_prompt_seen_at IS NULL;
 RETURN true; END $$;
REVOKE ALL ON FUNCTION public.complete_crew_join_goal(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_crew_join_goal(uuid,text) TO authenticated,service_role;