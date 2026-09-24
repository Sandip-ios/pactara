CREATE OR REPLACE FUNCTION public.merge_solo_into_partner(_user uuid, _solo uuid, _target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _solo IS NULL OR _target IS NULL OR _solo = _target THEN RETURN; END IF;
  -- Only fold groups that are truly solo (this user alone).
  IF EXISTS (SELECT 1 FROM group_members WHERE group_id = _solo AND user_id <> _user) THEN RETURN; END IF;

  DELETE FROM daily_posts s WHERE s.group_id = _solo AND EXISTS (
    SELECT 1 FROM daily_posts t WHERE t.group_id = _target AND t.user_id = s.user_id AND t.local_date = s.local_date);
  DELETE FROM earned_badges s WHERE s.group_id = _solo AND EXISTS (
    SELECT 1 FROM earned_badges t WHERE t.group_id = _target AND t.user_id = s.user_id AND t.streak_days = s.streak_days);
  DELETE FROM streak_freezes_used s WHERE s.group_id = _solo AND EXISTS (
    SELECT 1 FROM streak_freezes_used t WHERE t.group_id = _target AND t.user_id = s.user_id AND t.freeze_date = s.freeze_date);
  UPDATE workout_sessions SET status = 'ended_without_completion', ended_at = now()
    WHERE group_id = _solo AND status = 'active';

  UPDATE check_ins SET group_id = _target WHERE group_id = _solo;
  UPDATE daily_posts SET group_id = _target WHERE group_id = _solo;
  UPDATE daily_thoughts SET group_id = _target WHERE group_id = _solo;
  UPDATE earned_badges SET group_id = _target WHERE group_id = _solo;
  UPDATE streak_freezes_used SET group_id = _target WHERE group_id = _solo;
  UPDATE workout_sessions SET group_id = _target WHERE group_id = _solo;
  UPDATE workout_cheers SET group_id = _target WHERE group_id = _solo;
  UPDATE group_messages SET group_id = _target WHERE group_id = _solo;

  UPDATE partner_queue SET solo_group_id = NULL WHERE solo_group_id = _solo;
  DELETE FROM group_members WHERE group_id = _solo;
  DELETE FROM groups WHERE id = _solo;
END; $$;

REVOKE ALL ON FUNCTION public.merge_solo_into_partner(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_solo_into_partner(uuid, uuid, uuid) TO service_role;

-- Clean up people already matched.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT pq.user_id, pq.solo_group_id, p.group_id FROM partner_queue pq
    JOIN partnerships p ON (p.user_1_id = pq.user_id OR p.user_2_id = pq.user_id)
    WHERE p.status = 'active' AND p.group_id IS NOT NULL AND pq.solo_group_id IS NOT NULL
  LOOP PERFORM public.merge_solo_into_partner(r.user_id, r.solo_group_id, r.group_id); END LOOP;
END $$;