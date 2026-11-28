CREATE OR REPLACE FUNCTION public.get_new_home_checkins(_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); result jsonb;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',c.id,
  'userId',c.user_id,
  'groupId',c.group_id,
  'localDate',c.checkin_date,
  'createdAt',c.created_at,
  'note',c.note,
  'activity',c.activity,
  'mood',c.mood,
  'photoUrl',c.photo_url,
  'health',c.health_workout,
  'name',p.name,
  'avatarUrl',p.avatar_url,
  'avatarColor',p.avatar_color,
  'postId',dp.id,
  'firstCheckInId',dp.check_in_id,
  'reactors',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('checkInId',r.check_in_id,'userId',r.user_id,'emoji',r.emoji,'name',rp.name,'avatarUrl',rp.avatar_url,'avatarColor',rp.avatar_color) ORDER BY r.created_at,r.id)
   FROM public.post_reactions r JOIN public.profiles rp ON rp.id=r.user_id
   WHERE r.post_id=dp.id AND NOT public.safety_pair_blocked(r.user_id,uid)
  ),'[]'::jsonb),
  'comments',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('checkInId',pc.check_in_id) ORDER BY pc.created_at,pc.id)
   FROM public.post_comments pc
   WHERE pc.post_id=dp.id AND NOT public.safety_pair_blocked(pc.user_id,uid)
  ),'[]'::jsonb),
  'workout',(
   SELECT jsonb_build_object(
    'title',ws.title,
    'exercises',COALESCE((ws.summary->>'exercises')::int,0),
    'sets',COALESCE((ws.summary->>'sets')::int,0),
    'minutes',COALESCE((ws.summary->>'minutes')::int,0),
    'pr',NULL,
    'prCount',COALESCE(jsonb_array_length(COALESCE(ws.summary->'prs','[]'::jsonb)),0),
    'prExercises',COALESCE((SELECT jsonb_agg(DISTINCT pr.value->>'name') FROM jsonb_array_elements(COALESCE(ws.summary->'prs','[]'::jsonb)) pr(value)),'[]'::jsonb)
   ) FROM public.workout_sessions ws
   WHERE ws.user_id=c.user_id AND ws.check_in_ids @> ARRAY[c.id] AND ws.logged_at IS NOT NULL LIMIT 1
  )
 )), '[]'::jsonb) INTO result
 FROM public.check_ins c
 JOIN public.profiles p ON p.id=c.user_id
 JOIN public.groups g ON g.id=c.group_id
 LEFT JOIN public.daily_posts dp ON dp.user_id=c.user_id AND dp.group_id=c.group_id AND dp.local_date=c.checkin_date
 WHERE c.id=ANY(_ids) AND g.ended_at IS NULL
  AND NOT public.safety_pair_blocked(c.user_id,uid)
  AND (c.user_id=uid OR EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id=c.group_id AND gm.user_id=uid) OR public.can_view_new_shared_checkin(c.id))
  AND NOT EXISTS(SELECT 1 FROM public.hidden_posts h WHERE h.user_id=uid AND h.post_id IN(c.id,dp.id));
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_home_checkin_social(_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; dp record; result jsonb;
BEGIN
 IF NOT public.can_use_home_checkin(_id) THEN RAISE EXCEPTION 'Check-in unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.check_ins WHERE id=_id;
 SELECT * INTO dp FROM public.daily_posts WHERE user_id=c.user_id AND group_id=c.group_id AND local_date=c.checkin_date;
 SELECT jsonb_build_object(
  'cheered',EXISTS(SELECT 1 FROM public.post_reactions r WHERE r.post_id=dp.id AND r.user_id=auth.uid() AND (r.check_in_id=c.id OR r.check_in_id IS NULL AND dp.check_in_id=c.id)),
  'cheers',(SELECT count(*) FROM public.post_reactions r WHERE r.post_id=dp.id AND (r.check_in_id=c.id OR r.check_in_id IS NULL AND dp.check_in_id=c.id) AND NOT public.safety_pair_blocked(r.user_id,auth.uid())),
  'saved',EXISTS(SELECT 1 FROM public.check_in_saves s WHERE s.user_id=auth.uid() AND s.check_in_id=c.id),
  'comments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',pc.id,'userId',pc.user_id,'name',p.name,'body',pc.body,'at',pc.created_at) ORDER BY pc.created_at) FROM public.post_comments pc JOIN public.profiles p ON p.id=pc.user_id WHERE pc.post_id=dp.id AND (pc.check_in_id=c.id OR pc.check_in_id IS NULL AND dp.check_in_id=c.id) AND NOT public.safety_pair_blocked(pc.user_id,auth.uid())),'[]'::jsonb),
  'workoutDetail',(
   SELECT jsonb_build_object(
    'title',ws.title,
    'summary',ws.summary,
    'isMine',c.user_id=auth.uid(),
    'savedWorkoutId',NULL,
    'dayLabel',NULL,
    'exercises',COALESCE((
     SELECT jsonb_agg(x.value ORDER BY x.position)
     FROM (
      SELECT l.position,jsonb_build_object(
       'exerciseId',l.exercise_id,
       'name',e.name,
       'imageStart',e.image_start,
       'logType',e.log_type,
       'equipment',e.equipment,
       'sets',jsonb_agg(jsonb_build_object('weight',l.weight,'unit',l.unit,'reps',l.reps,'seconds',l.seconds,'isPr',l.is_pr) ORDER BY l.set_no)
      ) value
      FROM public.workout_set_logs l JOIN public.exercises e ON e.id=l.exercise_id
      WHERE l.session_id=ws.id
      GROUP BY l.position,l.exercise_id,e.name,e.image_start,e.log_type,e.equipment
     ) x
    ),'[]'::jsonb)
   ) FROM public.workout_sessions ws
   WHERE ws.user_id=c.user_id AND ws.check_in_ids @> ARRAY[c.id] AND ws.logged_at IS NOT NULL LIMIT 1
  )
 ) INTO result;
 RETURN result;
END $$;