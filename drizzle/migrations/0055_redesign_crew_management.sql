ALTER TABLE public.groups ADD COLUMN about text;
ALTER TABLE public.groups ADD CONSTRAINT groups_about_max CHECK (about IS NULL OR char_length(about) <= 120);
GRANT SELECT (about), UPDATE (about) ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
COMMENT ON COLUMN public.groups.about IS 'Optional crew description; existing member-read and owner-update RLS applies.';
CREATE FUNCTION public.manage_redesign_crew(_group_id uuid, _member_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid; _next uuid;
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT owner_id INTO _owner FROM public.groups WHERE id = _group_id FOR UPDATE;
 IF _owner IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'Only the person who runs this crew can do that'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _uid) THEN RAISE EXCEPTION 'You are not in this crew'; END IF;
 IF _action = 'leave' THEN
   SELECT user_id INTO _next FROM public.group_members WHERE group_id = _group_id AND user_id <> _uid ORDER BY joined_at, user_id LIMIT 1;
   IF _next IS NULL THEN RAISE EXCEPTION 'Invite someone or transfer ownership before leaving'; END IF;
   UPDATE public.groups SET owner_id = _next WHERE id = _group_id;
   PERFORM public.leave_crew(_group_id);
   RETURN;
 END IF;
 IF _action NOT IN ('transfer','remove') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 IF _member_id IS NULL OR _member_id = _uid THEN RAISE EXCEPTION 'Choose another member'; END IF;
 PERFORM 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _member_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This person is no longer in the crew'; END IF;
 IF _action = 'transfer' THEN
   UPDATE public.groups SET owner_id = _member_id WHERE id = _group_id;
 ELSE
   INSERT INTO public.group_member_departures (group_id,user_id,joined_at,pact_signed_at,personal_goal,personal_goal_set_at)
   SELECT group_id,user_id,joined_at,pact_signed_at,personal_goal,personal_goal_set_at FROM public.group_members WHERE group_id = _group_id AND user_id = _member_id;
   DELETE FROM public.group_members WHERE group_id = _group_id AND user_id = _member_id;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_redesign_crew(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_redesign_crew(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_redesign_crew(uuid,uuid,text) TO service_role;