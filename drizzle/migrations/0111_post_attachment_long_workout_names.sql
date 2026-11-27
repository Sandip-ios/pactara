CREATE OR REPLACE FUNCTION public.toggle_post_attachment(_post_id uuid,_kind text,_on boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); p record; result uuid; moves jsonb;
BEGIN
 IF uid IS NULL OR NOT public.is_new_version_user(uid) THEN RAISE EXCEPTION 'Not available' USING ERRCODE='42501'; END IF;
 IF _kind NOT IN ('workout','meal') THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||_post_id::text||_kind,0));
 IF NOT _on THEN
  IF _kind='workout' THEN DELETE FROM public.workouts WHERE user_id=uid AND source_post_id=_post_id; ELSE DELETE FROM public.meals WHERE user_id=uid AND source_post_id=_post_id; END IF;
  RETURN NULL;
 END IF;
 SELECT * INTO p FROM public.social_posts WHERE id=_post_id;
 IF NOT FOUND OR p.user_id=uid OR NOT public.can_see_social_post(_post_id,uid) OR public.safety_pair_blocked(uid,p.user_id) THEN RAISE EXCEPTION 'Post unavailable' USING ERRCODE='42501'; END IF;
 IF _kind='workout' THEN
  IF p.workout IS NULL THEN RAISE EXCEPTION 'No workout'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('exerciseId',m->>'exerciseId','sets',jsonb_array_length(m->'sets'),'reps',(m->'sets'->0->'reps'),'seconds',(m->'sets'->0->'seconds'),'restSeconds',90) ORDER BY pos),'[]'::jsonb) INTO moves FROM jsonb_array_elements(p.workout->'moves') WITH ORDINALITY AS x(m,pos);
  INSERT INTO public.workouts(user_id,name,exercises,source_post_id,source_user_id) VALUES(uid,left(COALESCE(NULLIF(btrim(p.workout->>'title'),''),'Workout'),60),moves,p.id,p.user_id) ON CONFLICT(user_id,source_post_id) WHERE source_post_id IS NOT NULL DO UPDATE SET source_post_id=EXCLUDED.source_post_id RETURNING id INTO result;
 ELSE
  IF p.meal IS NULL THEN RAISE EXCEPTION 'No meal'; END IF;
  INSERT INTO public.meals(user_id,name,snapshot,source_post_id) VALUES(uid,p.meal->>'title',p.meal,p.id) ON CONFLICT(user_id,source_post_id) DO UPDATE SET source_post_id=EXCLUDED.source_post_id RETURNING id INTO result;
 END IF;
 RETURN result;
END $$;