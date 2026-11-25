CREATE OR REPLACE FUNCTION public.validate_safety_interaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE author uuid; parent_author uuid; BEGIN
IF TG_TABLE_NAME IN ('post_comments','post_reactions') THEN SELECT user_id INTO author FROM daily_posts WHERE id=NEW.post_id;
ELSIF TG_TABLE_NAME='comment_likes' THEN SELECT user_id INTO author FROM post_comments WHERE id=NEW.comment_id;
ELSIF TG_TABLE_NAME='message_reactions' THEN SELECT user_id INTO author FROM group_messages WHERE id=NEW.message_id;
ELSIF TG_TABLE_NAME='workout_cheers' THEN SELECT user_id INTO author FROM workout_sessions WHERE id=NEW.session_id;
ELSIF TG_TABLE_NAME='member_nudges' THEN IF safety_pair_blocked(NEW.nudger_id,NEW.target_id) THEN RAISE EXCEPTION 'Interaction not allowed'; END IF; RETURN NEW;
END IF;
IF author IS NULL OR safety_pair_blocked(NEW.user_id,author) THEN RAISE EXCEPTION 'Interaction not allowed'; END IF;
IF TG_TABLE_NAME='post_comments' THEN
IF NEW.parent_comment_id IS NOT NULL THEN SELECT user_id INTO parent_author FROM post_comments WHERE id=NEW.parent_comment_id; IF safety_pair_blocked(NEW.user_id,parent_author) THEN RAISE EXCEPTION 'Interaction not allowed'; END IF; END IF;
END IF;
RETURN NEW; END $$;