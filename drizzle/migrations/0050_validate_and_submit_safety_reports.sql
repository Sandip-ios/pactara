CREATE FUNCTION public.validate_content_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE author uuid; crew uuid; BEGIN
IF NEW.target_type='user' THEN IF NEW.target_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid target'; END IF;
ELSIF NEW.target_type='comment' THEN SELECT c.user_id,p.group_id INTO author,crew FROM post_comments c JOIN daily_posts p ON p.id=c.post_id WHERE c.id=NEW.target_id;
ELSE SELECT user_id,group_id INTO author,crew FROM check_ins WHERE id=NEW.target_id; IF author IS NULL THEN SELECT user_id,group_id INTO author,crew FROM daily_thoughts WHERE id=NEW.target_id; END IF; IF author IS NULL THEN SELECT user_id,group_id INTO author,crew FROM daily_posts WHERE id=NEW.target_id; END IF;
END IF;
IF NEW.target_type<>'user' AND (author IS NULL OR author<>NEW.reported_user_id OR crew<>NEW.group_id) THEN RAISE EXCEPTION 'Invalid target'; END IF; RETURN NEW; END $$;
CREATE TRIGGER validate_report BEFORE INSERT ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.validate_content_report();
CREATE FUNCTION public.submit_content_report(_reported uuid,_type text,_target uuid,_group uuid,_reason text,_details text,_block boolean) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
INSERT INTO content_reports(reporter_id,reported_user_id,target_type,target_id,group_id,reason,details) VALUES(auth.uid(),_reported,_type,_target,_group,_reason,_details);
IF _block THEN INSERT INTO user_blocks(blocker_id,blocked_id) VALUES(auth.uid(),_reported) ON CONFLICT DO NOTHING; END IF; END $$;
REVOKE ALL ON FUNCTION public.submit_content_report(uuid,text,uuid,uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_content_report(uuid,text,uuid,uuid,text,text,boolean) TO authenticated;