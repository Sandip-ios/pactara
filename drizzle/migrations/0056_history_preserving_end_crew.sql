ALTER TABLE public.groups ADD COLUMN ended_at timestamptz NULL, ADD COLUMN ended_by uuid NULL;
GRANT SELECT (ended_at, ended_by) ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
COMMENT ON COLUMN public.groups.ended_at IS 'Ended crews are inactive; membership and all historical activity remain intact.';
CREATE FUNCTION public.crew_is_active(_group_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND ended_at IS NULL) $$;
REVOKE ALL ON FUNCTION public.crew_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crew_is_active(uuid) TO authenticated, service_role;
CREATE FUNCTION public.end_crew(_group_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _ended timestamptz; _uid uuid := auth.uid();
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT owner_id, ended_at INTO _owner, _ended FROM public.groups WHERE id = _group_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This crew is no longer available'; END IF;
 IF _owner IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'Only the person who runs this crew can end it'; END IF;
 IF _ended IS NULL THEN UPDATE public.groups SET ended_at = now(), ended_by = _uid WHERE id = _group_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.end_crew(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_crew(uuid) TO authenticated;
CREATE FUNCTION public.protect_ended_crew() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.ended_at IS NOT NULL OR NEW.ended_by IS NOT NULL THEN RAISE EXCEPTION 'Create an active crew first'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.ended_at IS NOT NULL THEN RAISE EXCEPTION 'This crew has ended'; END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 IF NEW.ended_at IS NOT NULL THEN
  IF auth.uid() IS NULL OR OLD.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who runs this crew can end it'; END IF;
  NEW.ended_at := now(); NEW.ended_by := auth.uid(); NEW.owner_id := OLD.owner_id;
 ELSIF NEW.ended_by IS NOT NULL THEN RAISE EXCEPTION 'End the crew to set its ending owner';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_ended_crew BEFORE INSERT OR UPDATE OR DELETE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.protect_ended_crew();
CREATE FUNCTION public.guard_active_crew_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row jsonb; _group_id uuid; _ended timestamptz;
BEGIN
 IF TG_OP = 'DELETE' THEN _row := to_jsonb(OLD); ELSE _row := to_jsonb(NEW); END IF;
 _group_id := NULLIF(_row->>'group_id','')::uuid;
 IF TG_TABLE_NAME IN ('post_comments','post_reactions') THEN
  SELECT group_id INTO _group_id FROM public.daily_posts WHERE id = (_row->>'post_id')::uuid;
 ELSIF TG_TABLE_NAME = 'comment_likes' THEN
  SELECT p.group_id INTO _group_id FROM public.post_comments c JOIN public.daily_posts p ON p.id=c.post_id WHERE c.id=(_row->>'comment_id')::uuid;
 ELSIF TG_TABLE_NAME = 'message_reactions' THEN
  SELECT group_id INTO _group_id FROM public.group_messages WHERE id=(_row->>'message_id')::uuid;
 END IF;
 IF _group_id IS NOT NULL THEN
  SELECT ended_at INTO _ended FROM public.groups WHERE id=_group_id FOR SHARE;
  IF FOUND AND _ended IS NOT NULL THEN RAISE EXCEPTION 'This crew has ended'; END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER active_crew_check_ins BEFORE INSERT OR UPDATE ON public.check_ins FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_daily_posts BEFORE INSERT OR UPDATE ON public.daily_posts FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_messages BEFORE INSERT OR UPDATE ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_members BEFORE INSERT OR UPDATE OR DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_comments BEFORE INSERT OR UPDATE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_reactions BEFORE INSERT OR UPDATE ON public.post_reactions FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_comment_likes BEFORE INSERT OR UPDATE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_message_reactions BEFORE INSERT OR UPDATE ON public.message_reactions FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_nudges BEFORE INSERT OR UPDATE ON public.member_nudges FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_freezes BEFORE INSERT OR UPDATE ON public.streak_freezes_used FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE TRIGGER active_crew_workout_cheers BEFORE INSERT OR UPDATE ON public.workout_cheers FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
CREATE POLICY "Ended crew check-ins preserve own history" ON public.check_ins AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id) OR user_id=auth.uid());
CREATE POLICY "Ended crew posts preserve own history" ON public.daily_posts AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id) OR user_id=auth.uid());
CREATE POLICY "Ended crew chat is closed" ON public.group_messages AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id));
CREATE POLICY "Ended crew comments are closed" ON public.post_comments AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.daily_posts p WHERE p.id=post_id AND public.crew_is_active(p.group_id)));
CREATE POLICY "Ended crew reactions are closed" ON public.post_reactions AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.daily_posts p WHERE p.id=post_id AND public.crew_is_active(p.group_id)));
CREATE POLICY "Ended crew message reactions are closed" ON public.message_reactions AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.group_messages m WHERE m.id=message_id AND public.crew_is_active(m.group_id)));
CREATE POLICY "Ended crew comment likes are closed" ON public.comment_likes AS RESTRICTIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.post_comments c JOIN public.daily_posts p ON p.id=c.post_id WHERE c.id=comment_id AND public.crew_is_active(p.group_id)));
CREATE POLICY "Ended crew cheers are closed" ON public.workout_cheers AS RESTRICTIVE FOR SELECT TO authenticated USING (public.crew_is_active(group_id));
CREATE POLICY "Ended crew media keeps owner access" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (bucket_id <> 'chat-photos' OR owner=auth.uid() OR owner_id=auth.uid()::text OR EXISTS (SELECT 1 FROM public.check_ins c WHERE c.photo_url=storage.objects.name AND public.crew_is_active(c.group_id) AND public.is_group_member(c.group_id,auth.uid())) OR EXISTS (SELECT 1 FROM public.group_messages m WHERE m.image_url=storage.objects.name AND public.crew_is_active(m.group_id) AND public.is_group_member(m.group_id,auth.uid())) OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id::text=(storage.foldername(storage.objects.name))[1] AND g.ended_at IS NULL AND public.is_group_member(g.id,auth.uid())));
CREATE OR REPLACE FUNCTION public.workout_detail_for_check_in(_check_in_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT jsonb_build_object('title',ws.title,'summary',ws.summary,'sessionId',ws.id,'userId',c.user_id,'checkinDate',c.checkin_date,'sets',COALESCE((SELECT jsonb_agg(jsonb_build_object('exerciseId',l.exercise_id,'name',e.name,'imageStart',e.image_start,'logType',e.log_type,'equipment',e.equipment,'position',l.position,'setNo',l.set_no,'weight',l.weight,'unit',l.unit,'reps',l.reps,'seconds',l.seconds,'isPr',l.is_pr) ORDER BY l.position,l.set_no) FROM workout_set_logs l JOIN exercises e ON e.id=l.exercise_id WHERE l.session_id=ws.id),'[]'::jsonb)) FROM check_ins c JOIN workout_sessions ws ON ws.check_in_ids @> ARRAY[c.id] AND ws.user_id=c.user_id WHERE c.id=_check_in_id AND ws.logged_at IS NOT NULL AND (public.crew_is_active(c.group_id) OR c.user_id=auth.uid()) AND is_group_member(c.group_id,auth.uid()) AND safety_visible(c.user_id) LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.workout_summaries_for_check_ins(_check_in_ids uuid[]) RETURNS TABLE(check_in_id uuid, session_id uuid, title text, summary jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT c.id,ws.id,ws.title,ws.summary FROM check_ins c JOIN workout_sessions ws ON ws.check_in_ids @> ARRAY[c.id] AND ws.user_id=c.user_id WHERE c.id=ANY(_check_in_ids) AND ws.logged_at IS NOT NULL AND (public.crew_is_active(c.group_id) OR c.user_id=auth.uid()) AND is_group_member(c.group_id,auth.uid()) AND safety_visible(c.user_id) $$;
CREATE OR REPLACE FUNCTION public.plan_tags_for_check_ins(_check_in_ids uuid[]) RETURNS TABLE(check_in_id uuid, plan_name text, plan_slug text, week integer, day_number integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT l.check_in_id,p.name,p.slug,l.week,l.day_number FROM plan_workout_logs l JOIN user_plans up ON up.id=l.user_plan_id JOIN plans p ON p.id=up.plan_id JOIN check_ins ci ON ci.id=l.check_in_id WHERE l.check_in_id=ANY(_check_in_ids) AND auth.uid() IS NOT NULL AND (public.crew_is_active(ci.group_id) OR ci.user_id=auth.uid()) AND is_group_member(ci.group_id,auth.uid()) AND safety_visible(ci.user_id) $$;