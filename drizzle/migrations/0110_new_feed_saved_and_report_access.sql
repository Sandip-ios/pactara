CREATE POLICY "New shared check-in saves readable" ON public.check_in_saves FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.can_use_home_checkin(check_in_id));
CREATE OR REPLACE FUNCTION public.validate_content_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE author uuid; crew uuid;
BEGIN
 IF NEW.target_type='post' AND public.is_new_version_user(NEW.reporter_id) THEN
  SELECT p.user_id INTO author FROM public.social_posts p WHERE p.id=NEW.target_id;
  IF author IS NOT NULL THEN
   IF author<>NEW.reported_user_id OR NEW.group_id IS NOT NULL OR NOT public.can_see_social_post(NEW.target_id,NEW.reporter_id) THEN RAISE EXCEPTION 'Invalid target'; END IF;
   RETURN NEW;
  END IF;
 END IF;
 IF NEW.target_type='user' THEN IF NEW.target_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid target'; END IF;
 ELSIF NEW.target_type='comment' THEN SELECT c.user_id,p.group_id INTO author,crew FROM post_comments c JOIN daily_posts p ON p.id=c.post_id WHERE c.id=NEW.target_id;
 ELSE SELECT user_id,group_id INTO author,crew FROM check_ins WHERE id=NEW.target_id; IF author IS NULL THEN SELECT user_id,group_id INTO author,crew FROM daily_thoughts WHERE id=NEW.target_id; END IF; IF author IS NULL THEN SELECT user_id,group_id INTO author,crew FROM daily_posts WHERE id=NEW.target_id; END IF;
 END IF;
 IF NEW.target_type<>'user' AND (author IS NULL OR author<>NEW.reported_user_id OR crew<>NEW.group_id) THEN RAISE EXCEPTION 'Invalid target'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.report_new_home_post(_id uuid,_reported uuid,_reason text,_details text,_block boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); author uuid; crew uuid;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO author FROM public.social_posts WHERE id=_id AND public.can_see_social_post(id,uid);
 IF author IS NULL THEN
  IF NOT public.can_use_home_checkin(_id) THEN RAISE EXCEPTION 'Post unavailable' USING ERRCODE='42501'; END IF;
  SELECT user_id,group_id INTO author,crew FROM public.check_ins WHERE id=_id;
 END IF;
 IF author IS NULL OR author<>_reported OR author=uid THEN RAISE EXCEPTION 'Invalid target' USING ERRCODE='42501'; END IF;
 INSERT INTO public.content_reports(reporter_id,reported_user_id,target_type,target_id,group_id,reason,details) VALUES(uid,author,'post',_id,crew,_reason,_details);
 IF _block THEN INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(uid,author) ON CONFLICT DO NOTHING; END IF;
END $$;
REVOKE ALL ON FUNCTION public.report_new_home_post(uuid,uuid,text,text,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.report_new_home_post(uuid,uuid,text,text,boolean) TO authenticated;