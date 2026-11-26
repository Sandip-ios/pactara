ALTER TABLE public.profiles ALTER COLUMN is_private SET DEFAULT false;
CREATE TABLE public.follows (
 follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('requested','accepted')),
 created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz,
 PRIMARY KEY(follower_id,following_id), CHECK(follower_id<>following_id),
 CHECK((status='accepted')=(accepted_at IS NOT NULL))
);
GRANT SELECT ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_participants ON public.follows FOR SELECT TO authenticated USING(follower_id=auth.uid() OR following_id=auth.uid());
CREATE INDEX follows_following ON public.follows(following_id,status,follower_id);
CREATE INDEX follows_follower ON public.follows(follower_id,status,following_id);
CREATE TABLE public.follow_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('follow','follow_request','follow_accepted')),
 created_at timestamptz NOT NULL DEFAULT now(), push_claimed_at timestamptz
);
GRANT SELECT ON public.follow_notifications TO authenticated;
GRANT ALL ON public.follow_notifications TO service_role;
ALTER TABLE public.follow_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY follow_notifications_recipient ON public.follow_notifications FOR SELECT TO authenticated USING(recipient_id=auth.uid() AND public.is_new_version_user(auth.uid()) AND NOT public.safety_pair_blocked(actor_id,recipient_id));
CREATE INDEX follow_notifications_recipient_time ON public.follow_notifications(recipient_id,created_at DESC);
CREATE FUNCTION public.enforce_profile_teen_privacy() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.birthday IS NOT NULL AND NEW.birthday > (CURRENT_DATE-interval '18 years')::date THEN NEW.is_private:=true; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER profiles_teen_privacy BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_teen_privacy();
UPDATE public.profiles SET is_private=true WHERE birthday > (CURRENT_DATE-interval '18 years')::date AND NOT is_private;
CREATE FUNCTION public.lock_follow_pair(_a uuid,_b uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF _a IS NULL OR _b IS NULL OR _a=_b THEN RAISE EXCEPTION 'Invalid follow target'; END IF;
 PERFORM id FROM public.profiles WHERE id IN (_a,_b) ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_b) THEN RAISE EXCEPTION 'Profile not found'; END IF;
 IF public.safety_pair_blocked(_a,_b) THEN RAISE EXCEPTION 'Interaction not allowed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.lock_follow_pair(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.follow_user(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); s text; r public.follows; BEGIN
 PERFORM public.lock_follow_pair(u,target);
 SELECT * INTO r FROM public.follows WHERE follower_id=u AND following_id=target;
 IF FOUND THEN RETURN jsonb_build_object('status',r.status,'changed',false); END IF;
 SELECT CASE WHEN is_private OR birthday>(CURRENT_DATE-interval '18 years')::date THEN 'requested' ELSE 'accepted' END INTO s FROM public.profiles WHERE id=target;
 INSERT INTO public.follows(follower_id,following_id,status,accepted_at) VALUES(u,target,s,CASE WHEN s='accepted' THEN now() END);
 INSERT INTO public.follow_notifications(actor_id,recipient_id,kind) VALUES(u,target,CASE WHEN s='accepted' THEN 'follow' ELSE 'follow_request' END);
 RETURN jsonb_build_object('status',s,'changed',true);
END $$;
CREATE FUNCTION public.unfollow_user(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.lock_follow_pair(auth.uid(),target);
 DELETE FROM public.follows WHERE follower_id=auth.uid() AND following_id=target;
END $$;
CREATE FUNCTION public.respond_follow_request(follower uuid,accept boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN
 IF accept IS NULL THEN RAISE EXCEPTION 'Decision required'; END IF;
 PERFORM public.lock_follow_pair(auth.uid(),follower);
 IF accept THEN
 UPDATE public.follows SET status='accepted',accepted_at=now() WHERE follower_id=follower AND following_id=auth.uid() AND status='requested';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n>0 THEN INSERT INTO public.follow_notifications(actor_id,recipient_id,kind) VALUES(auth.uid(),follower,'follow_accepted'); END IF;
 ELSE
 DELETE FROM public.follows WHERE follower_id=follower AND following_id=auth.uid() AND status='requested';
 GET DIAGNOSTICS n=ROW_COUNT;
 END IF;
 RETURN jsonb_build_object('changed',n>0);
END $$;
CREATE FUNCTION public.remove_follower(follower uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.lock_follow_pair(auth.uid(),follower);
 DELETE FROM public.follows WHERE follower_id=follower AND following_id=auth.uid();
END $$;
CREATE FUNCTION public.accept_public_profile_requests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r record; BEGIN
 IF OLD.is_private AND NOT NEW.is_private THEN
 FOR r IN UPDATE public.follows SET status='accepted',accepted_at=now() WHERE following_id=NEW.id AND status='requested' AND NOT public.safety_pair_blocked(follower_id,following_id) RETURNING follower_id LOOP
 INSERT INTO public.follow_notifications(actor_id,recipient_id,kind) VALUES(NEW.id,r.follower_id,'follow_accepted');
 END LOOP;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER profiles_accept_follow_requests AFTER UPDATE OF is_private ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.accept_public_profile_requests();
CREATE FUNCTION public.block_removes_follows() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM id FROM public.profiles WHERE id IN (NEW.blocker_id,NEW.blocked_id) ORDER BY id FOR UPDATE;
 DELETE FROM public.follows WHERE (follower_id=NEW.blocker_id AND following_id=NEW.blocked_id) OR (follower_id=NEW.blocked_id AND following_id=NEW.blocker_id);
 RETURN NEW;
END $$;
CREATE TRIGGER user_blocks_remove_follows BEFORE INSERT ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.block_removes_follows();
CREATE FUNCTION public.set_profile_privacy(private boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR private IS NULL THEN RAISE EXCEPTION 'Authentication and privacy required'; END IF;
 UPDATE public.profiles SET is_private=private WHERE id=auth.uid();
END $$;
CREATE FUNCTION public.get_profile(target text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.profiles; u uuid:=auth.uid(); relationship text; visible boolean; result jsonb; BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id::text=target OR username=lower(target) LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 relationship:=CASE WHEN public.safety_pair_blocked(u,p.id) THEN 'blocked'
 WHEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=u AND following_id=p.id AND status='accepted') THEN 'following'
 WHEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=u AND following_id=p.id AND status='requested') THEN 'requested'
 WHEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=p.id AND following_id=u AND status='accepted') THEN 'follows_you' ELSE 'none' END;
 visible:=relationship<>'blocked' AND (p.id=u OR (NOT p.is_private AND NOT coalesce(p.birthday>(CURRENT_DATE-interval '18 years')::date,false)) OR relationship='following');
 result:=jsonb_build_object('id',p.id,'name',p.name,'username',p.username,'bio',p.bio,'avatar',p.avatar_url,
 'follower_count',(SELECT count(*) FROM public.follows WHERE following_id=p.id AND status='accepted'),
 'following_count',(SELECT count(*) FROM public.follows WHERE follower_id=p.id AND status='accepted'),
 'is_private',p.is_private OR coalesce(p.birthday>(CURRENT_DATE-interval '18 years')::date,false),'relationship',relationship);
 IF visible THEN result:=result || jsonb_build_object('shares_crew',EXISTS(SELECT 1 FROM public.group_members a JOIN public.group_members b ON a.group_id=b.group_id WHERE a.user_id=u AND b.user_id=p.id)); END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.list_profile_follows(target uuid,direction text, page_size integer DEFAULT 50, page_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid,first_name text,username text,avatar text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE p jsonb; BEGIN
 IF direction NOT IN ('followers','following') OR direction IS NULL THEN RAISE EXCEPTION 'Invalid direction'; END IF;
 p:=public.get_profile(target::text);
 IF p IS NULL OR NOT (p ? 'shares_crew') THEN RETURN; END IF;
 RETURN QUERY SELECT q.id,coalesce(nullif(split_part(trim(q.name),' ',1),''),'Member'),q.username,q.avatar_url
 FROM public.follows f JOIN public.profiles q ON q.id=CASE WHEN direction='followers' THEN f.follower_id ELSE f.following_id END
 WHERE f.status='accepted' AND CASE WHEN direction='followers' THEN f.following_id=target ELSE f.follower_id=target END
 AND NOT public.safety_pair_blocked(auth.uid(),q.id)
 ORDER BY f.created_at DESC,q.id LIMIT greatest(1,least(page_size,100)) OFFSET greatest(0,page_offset);
END $$;
CREATE FUNCTION public.get_follow_profile_stats(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('timezone',p.timezone,'crews',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.group_id,'dates',coalesce((SELECT jsonb_agg(checkin_date) FROM public.check_ins WHERE user_id=p.id AND group_id=g.group_id),'[]'::jsonb),'freezes',coalesce((SELECT jsonb_agg(freeze_date) FROM public.streak_freezes_used WHERE user_id=p.id AND group_id=g.group_id),'[]'::jsonb))) FROM public.group_members g WHERE g.user_id=p.id),'[]'::jsonb),'badge_count',(SELECT count(DISTINCT streak_days) FROM public.earned_badges WHERE user_id=p.id)) FROM public.profiles p WHERE p.id=target
$$;
REVOKE ALL ON FUNCTION public.get_follow_profile_stats(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_profile_stats(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.follow_user(uuid),public.unfollow_user(uuid),public.respond_follow_request(uuid,boolean),public.remove_follower(uuid),public.set_profile_privacy(boolean),public.get_profile(text),public.list_profile_follows(uuid,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.follow_user(uuid),public.unfollow_user(uuid),public.respond_follow_request(uuid,boolean),public.remove_follower(uuid),public.set_profile_privacy(boolean),public.get_profile(text),public.list_profile_follows(uuid,text,integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_profile_teen_privacy(),public.accept_public_profile_requests(),public.block_removes_follows() FROM PUBLIC,anon,authenticated;