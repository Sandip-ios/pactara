CREATE FUNCTION public.get_social_list(target uuid, direction text, page_offset integer DEFAULT 0, query_text text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); p jsonb; people jsonb; total integer;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF direction NOT IN ('followers','following','requests') OR direction IS NULL THEN RAISE EXCEPTION 'Invalid direction'; END IF;
 p:=public.get_profile(target::text);
 IF p IS NULL OR NOT (p ? 'shares_crew') THEN RAISE EXCEPTION 'This list is private'; END IF;
 IF direction='requests' AND target<>u THEN RAISE EXCEPTION 'Only your own requests are available'; END IF;
 SELECT count(*) INTO total FROM public.follows f WHERE (CASE WHEN direction='following' THEN f.follower_id=target ELSE f.following_id=target END) AND f.status=CASE WHEN direction='requests' THEN 'requested' ELSE 'accepted' END AND NOT public.safety_pair_blocked(u,CASE WHEN direction='following' THEN f.following_id ELSE f.follower_id END);
 SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC,id),'[]'::jsonb) INTO people FROM (
 SELECT q.id,f.created_at,jsonb_build_object('id',q.id,'name',coalesce(nullif(trim(q.name),''),q.username,'Member'),'username',q.username,'avatar',q.avatar_url,'isSelf',q.id=u,'relationship',public.get_profile(q.id::text)->>'relationship','canFollow',coalesce((public.get_profile(q.id::text)->>'can_follow')::boolean,false),'sharedCrew',(SELECT g.name FROM public.groups g JOIN public.group_members a ON a.group_id=g.id JOIN public.group_members b ON b.group_id=g.id WHERE a.user_id=u AND b.user_id=q.id AND g.ended_at IS NULL ORDER BY a.joined_at DESC,g.id LIMIT 1)) AS row_data
 FROM public.follows f JOIN public.profiles q ON q.id=CASE WHEN direction='following' THEN f.following_id ELSE f.follower_id END
 WHERE (CASE WHEN direction='following' THEN f.follower_id=target ELSE f.following_id=target END) AND f.status=CASE WHEN direction='requests' THEN 'requested' ELSE 'accepted' END AND NOT public.safety_pair_blocked(u,q.id)
 AND (coalesce(query_text,'')='' OR strpos(lower(coalesce(q.name,'')),lower(trim(query_text)))>0 OR strpos(lower(coalesce(q.username,'')),lower(trim(query_text)))>0)
 ORDER BY f.created_at DESC,q.id LIMIT 31 OFFSET greatest(0,page_offset)
 ) listed;
 RETURN jsonb_build_object('profile',p,'people',people,'total',total);
END $$;
REVOKE ALL ON FUNCTION public.get_social_list(uuid,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_social_list(uuid,text,integer,text) TO authenticated;
CREATE FUNCTION public.get_redesign_activity_extras() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); events jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NOT public.is_new_version_user(u) THEN RETURN '[]'::jsonb; END IF;
 WITH my_groups AS (SELECT g.id,g.name,g.owner_id,g.start_date,g.previous_start_date FROM public.groups g JOIN public.group_members m ON m.group_id=g.id WHERE m.user_id=u AND g.ended_at IS NULL), raw AS (
 SELECT 'nudge:'||n.id AS key,'nudge' AS kind,n.nudger_id AS actor_id,n.created_at,g.id AS group_id,g.name AS group_name,'nudged you to check in' AS text,false AS can_check_in FROM public.member_nudges n JOIN my_groups g ON g.id=n.group_id WHERE n.target_id=u AND n.created_at>=now()-interval '30 days'
 UNION ALL SELECT 'crew_request:'||r.id,'crew_request',r.requester_id,r.created_at,g.id,g.name,'asked to join '||g.name,false FROM public.crew_join_requests r JOIN my_groups g ON g.id=r.group_id WHERE g.owner_id=u AND r.status='pending' AND r.created_at>now()-interval '14 days'
 UNION ALL SELECT 'milestone:'||b.id,'milestone',b.user_id,b.earned_at,g.id,g.name,'reached a '||b.streak_days||'-day streak in '||g.name,false FROM public.earned_badges b JOIN my_groups g ON g.id=b.group_id WHERE b.earned_at>=now()-interval '30 days'
 UNION ALL SELECT 'pact_restart:'||g.id||':'||g.start_date,'pact_restart',g.owner_id,g.start_date::timestamptz,g.id,g.name,'started a new pact in '||g.name,false FROM my_groups g WHERE g.previous_start_date IS NOT NULL AND g.start_date>=current_date-30
 UNION ALL SELECT 'evening:'||e.local_date,'reminder',u,e.updated_at,g.id,g.name,'Your check-in reminder for '||g.name,(e.local_date=(now() AT TIME ZONE coalesce(p.timezone,'UTC'))::date AND NOT EXISTS(SELECT 1 FROM public.check_ins c WHERE c.user_id=u AND c.group_id=g.id AND c.checkin_date=(now() AT TIME ZONE coalesce(p.timezone,'UTC'))::date)) FROM public.evening_push_sends e JOIN public.profiles p ON p.id=u JOIN LATERAL (SELECT mg.* FROM my_groups mg WHERE mg.id=ANY(e.group_ids) ORDER BY mg.id LIMIT 1) g ON true WHERE e.user_id=u AND e.status='sent' AND e.updated_at>=now()-interval '30 days'
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('key',r.key,'kind',r.kind,'actorId',r.actor_id,'actorName',coalesce(nullif(trim(p.name),''),p.username,'Member'),'avatar',p.avatar_url,'createdAt',r.created_at,'groupId',r.group_id,'groupName',r.group_name,'text',r.text,'canCheckIn',r.can_check_in) ORDER BY r.created_at DESC),'[]'::jsonb) INTO events FROM raw r JOIN public.profiles p ON p.id=r.actor_id WHERE NOT public.safety_pair_blocked(u,r.actor_id);
 RETURN events;
END $$;
REVOKE ALL ON FUNCTION public.get_redesign_activity_extras() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_redesign_activity_extras() TO authenticated;