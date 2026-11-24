CREATE FUNCTION public.post_health_check_in(_groups uuid[], _date date, _note text, _photo text, _mood text, _activity text, _health jsonb) RETURNS TABLE(check_in_id uuid, crew_id uuid) LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); gid uuid; cid uuid; stamp timestamptz := clock_timestamp(); old_ids uuid[];
BEGIN
 IF uid IS NULL OR cardinality(_groups) IS NULL OR cardinality(_groups) < 1 OR cardinality(_groups) > 20 OR _health IS NULL THEN RAISE EXCEPTION 'Invalid Health check-in'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(_groups) g WHERE NOT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = g AND m.user_id = uid)) THEN RAISE EXCEPTION 'Not a crew member'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || (_health->>'uuid'), 0));
 IF EXISTS (SELECT 1 FROM public.check_ins c WHERE c.user_id = uid AND c.health_workout->>'uuid' = _health->>'uuid') THEN
  IF EXISTS (SELECT 1 FROM public.check_ins c WHERE c.user_id = uid AND c.health_workout->>'uuid' = _health->>'uuid' AND (c.photo_url IS DISTINCT FROM _photo OR c.health_workout IS DISTINCT FROM _health)) THEN RAISE EXCEPTION 'This Health workout has already been used'; END IF;
  IF (SELECT count(DISTINCT c.group_id) FROM public.check_ins c WHERE c.user_id = uid AND c.health_workout->>'uuid' = _health->>'uuid' AND c.group_id = ANY(_groups)) <> cardinality(_groups) THEN RAISE EXCEPTION 'This Health workout has already been used'; END IF;
  RETURN QUERY SELECT c.id, c.group_id FROM public.check_ins c WHERE c.user_id = uid AND c.health_workout->>'uuid' = _health->>'uuid' AND c.group_id = ANY(_groups);
  RETURN;
 END IF;
 FOREACH gid IN ARRAY _groups LOOP
  INSERT INTO public.check_ins (user_id, group_id, checkin_date, note, photo_url, mood, activity, health_workout, created_at) VALUES (uid, gid, _date, left(_note,500), _photo, left(_mood,40), left(_activity,40), _health, stamp) RETURNING id INTO cid;
  INSERT INTO public.daily_posts (user_id, group_id, local_date, check_in_id, check_in_missed) VALUES (uid, gid, _date, cid, false) ON CONFLICT (user_id,group_id,local_date) DO UPDATE SET check_in_id = coalesce(public.daily_posts.check_in_id, EXCLUDED.check_in_id), check_in_missed = false;
  check_in_id := cid; crew_id := gid; RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.post_health_check_in(uuid[],date,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_health_check_in(uuid[],date,text,text,text,text,jsonb) TO authenticated, service_role;