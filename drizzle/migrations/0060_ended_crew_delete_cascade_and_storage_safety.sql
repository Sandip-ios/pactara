CREATE OR REPLACE FUNCTION public.protect_ended_crew() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.ended_at IS NOT NULL OR NEW.ended_by IS NOT NULL THEN RAISE EXCEPTION 'Create an active crew first'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.ended_at IS NOT NULL THEN RAISE EXCEPTION 'This crew has ended'; END IF;
 IF NEW.ended_at IS NOT NULL THEN
  IF auth.uid() IS NULL OR OLD.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who runs this crew can end it'; END IF;
  NEW.ended_at := now(); NEW.ended_by := auth.uid(); NEW.owner_id := OLD.owner_id;
 ELSIF NEW.ended_by IS NOT NULL THEN RAISE EXCEPTION 'End the crew to set its ending owner';
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.guard_active_crew_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row jsonb; _group_id uuid; _ended timestamptz;
BEGIN
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 _row := to_jsonb(NEW);
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
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS active_crew_members ON public.group_members;
CREATE TRIGGER active_crew_members BEFORE INSERT OR UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.guard_active_crew_write();
DROP POLICY IF EXISTS "Ended crew media keeps owner access" ON storage.objects;