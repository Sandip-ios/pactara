CREATE FUNCTION public.review_content_report(_id uuid,_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r content_reports%ROWTYPE; c check_ins%ROWTYPE; t daily_thoughts%ROWTYPE; p daily_posts%ROWTYPE; BEGIN
IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
IF _action NOT IN ('remove_content','remove_member','dismiss') THEN RAISE EXCEPTION 'Invalid action'; END IF;
SELECT * INTO r FROM content_reports WHERE id=_id FOR UPDATE;
IF r.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
IF r.status<>'open' THEN RETURN; END IF;
IF _action='remove_content' THEN
IF r.target_type='user' THEN RAISE EXCEPTION 'No reported content'; END IF;
IF r.target_type='comment' THEN DELETE FROM post_comments WHERE id=r.target_id AND user_id=r.reported_user_id;
ELSE
SELECT * INTO c FROM check_ins WHERE id=r.target_id AND user_id=r.reported_user_id;
IF c.id IS NOT NULL THEN
UPDATE workout_sessions SET check_in_ids=array_remove(check_in_ids,c.id) WHERE c.id=ANY(check_in_ids);
DELETE FROM check_ins WHERE id=c.id;
UPDATE daily_posts SET check_in_id=(SELECT id FROM check_ins WHERE user_id=c.user_id AND group_id=c.group_id AND checkin_date=c.checkin_date ORDER BY created_at LIMIT 1) WHERE user_id=c.user_id AND group_id=c.group_id AND local_date=c.checkin_date AND check_in_id IS NULL;
ELSE
SELECT * INTO t FROM daily_thoughts WHERE id=r.target_id AND user_id=r.reported_user_id;
IF t.id IS NOT NULL THEN DELETE FROM daily_thoughts WHERE id=t.id;
ELSE SELECT * INTO p FROM daily_posts WHERE id=r.target_id AND user_id=r.reported_user_id;
IF p.id IS NOT NULL THEN
UPDATE workout_sessions SET check_in_ids=ARRAY[]::uuid[] WHERE group_id=p.group_id AND user_id=p.user_id AND local_date=p.local_date;
DELETE FROM check_ins WHERE user_id=p.user_id AND group_id=p.group_id AND checkin_date=p.local_date;
DELETE FROM daily_thoughts WHERE user_id=p.user_id AND group_id=p.group_id AND local_date=p.local_date;
DELETE FROM daily_posts WHERE id=p.id;
END IF; END IF; END IF; END IF;
ELSIF _action='remove_member' THEN
INSERT INTO group_member_departures(group_id,user_id,joined_at,left_at,pact_signed_at,personal_goal,personal_goal_set_at) SELECT group_id,user_id,joined_at,now(),pact_signed_at,personal_goal,personal_goal_set_at FROM group_members WHERE group_id=r.group_id AND user_id=r.reported_user_id;
DELETE FROM group_members WHERE group_id=r.group_id AND user_id=r.reported_user_id;
END IF;
UPDATE content_reports SET status=CASE WHEN _action='dismiss' THEN 'dismissed' ELSE 'removed' END,reviewed_at=now() WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.review_content_report(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_content_report(uuid,text) TO service_role;