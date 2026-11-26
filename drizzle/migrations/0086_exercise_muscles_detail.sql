ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS muscles_detail text[];
COMMENT ON COLUMN public.exercises.muscles_detail IS 'Detailed muscle tags for new-version chips, primary first. Classic reads primary_muscles.';

CREATE OR REPLACE FUNCTION public.exercise_muscles_detail(_name text, _primary text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
  SELECT NULLIF(ARRAY(
    SELECT t FROM (
      SELECT t, min(o*10+o2) AS ord
      FROM unnest(coalesce(_primary, ARRAY[]::text[])) WITH ORDINALITY AS p(m, o)
      CROSS JOIN LATERAL (SELECT lower(_name) AS n) x
      CROSS JOIN LATERAL unnest(
CASE m
 WHEN 'back' THEN CASE
  WHEN n ~ '\mshrug' THEN ARRAY['traps']
  WHEN n ~ '\m(extension|hyperextension|superman|good morning|deadlift|bird dog|cat|cobra|reverse hyper|jefferson|child|back lever|swimmer)' THEN ARRAY['lower back']
  WHEN n ~ '\m(pulldown|pull-down|pull down|pull up|pull-up|pullup|pull ups|chin|pullover|lat\M|straight-arm|straight arm|muscle up|muscle-up|front lever|scapular|hang\M|dead hang)' THEN ARRAY['lats']
  WHEN n ~ '\m(row|face pull|pull apart|reverse fly|rear|renegade|inverted|y raise|t raise|ytw|prone)' THEN ARRAY['upper back','lats']
  ELSE ARRAY['lats','upper back'] END
 WHEN 'shoulders' THEN CASE
  WHEN n ~ '\m(lateral|side raise|upright|cuban|lu raise)' THEN ARRAY['side delts']
  WHEN n ~ '\m(rear|reverse fly|face pull|pull apart|external rotation|internal rotation|ytw|prone|t raise|w raise|reverse)' THEN ARRAY['rear delts']
  WHEN n ~ '\m(press|arnold|handstand|jerk|thruster|push press)' THEN ARRAY['front delts','side delts']
  WHEN n ~ '\m(front raise|pike|push|plate raise|landmine|dip|raise)' THEN ARRAY['front delts']
  ELSE ARRAY['front delts','side delts'] END
 WHEN 'chest' THEN CASE WHEN n ~ '\m(incline|low-to-high|low to high)' THEN ARRAY['upper chest'] ELSE ARRAY['chest'] END
 WHEN 'abs' THEN CASE
  WHEN n ~ '\m(oblique|twist|side plank|side bend|woodchop|wood chop|russian|pallof|windmill|bicycle|suitcase|copenhagen|side crunch|heel touch|rotation|rotational|windshield|side)' THEN ARRAY['obliques']
  WHEN n ~ '\m(hanging leg|leg raise|knee raise|knee tuck|flutter|scissor|v-up|l-sit|mountain)' THEN ARRAY['abs','hip flexors']
  ELSE ARRAY['abs'] END
 WHEN 'quads' THEN CASE
  WHEN n ~ '\m(adduct|groin|copenhagen|butterfly|frog|cossack)' THEN ARRAY['adductors']
  WHEN n ~ '\m(hip flexor|psoas|couch)' THEN ARRAY['hip flexors']
  ELSE ARRAY['quads'] END
 WHEN 'glutes' THEN ARRAY['glutes'] WHEN 'hamstrings' THEN ARRAY['hamstrings'] WHEN 'calves' THEN ARRAY['calves']
 WHEN 'biceps' THEN ARRAY['biceps'] WHEN 'triceps' THEN ARRAY['triceps'] WHEN 'forearms' THEN ARRAY['forearms'] WHEN 'traps' THEN ARRAY['traps']
 ELSE ARRAY[]::text[] END
      ) WITH ORDINALITY AS d(t, o2)
      GROUP BY t) s ORDER BY ord), ARRAY[]::text[])
$fn$;
REVOKE ALL ON FUNCTION public.exercise_muscles_detail(text, text[]) FROM PUBLIC, anon, authenticated;

UPDATE public.exercises SET muscles_detail = public.exercise_muscles_detail(name, primary_muscles) WHERE owner_id IS NULL;

UPDATE public.exercises SET muscles_detail=ARRAY['upper back','lats'] WHERE id IN ('bench-pull','dumbbell-bench-pull');
UPDATE public.exercises SET muscles_detail=ARRAY['lats','biceps'] WHERE id='rope-climb';
UPDATE public.exercises SET muscles_detail=ARRAY['lats','obliques'] WHERE id='human-flag';
UPDATE public.exercises SET muscles_detail=ARRAY['rear delts','traps'] WHERE id='trx-y-fly';
UPDATE public.exercises SET muscles_detail=ARRAY['lats','abs','triceps'] WHERE id='ski-erg';
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','glutes','hamstrings','traps'] WHERE id='rack-pull';
UPDATE public.exercises SET muscles_detail=ARRAY['forearms','obliques','lower back'] WHERE id='suitcase-carry';
UPDATE public.exercises SET muscles_detail=ARRAY['lower back'] WHERE id IN ('sphinx-pose','pilates-roll-down');
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','abs'] WHERE id IN ('bird-dog','pilates-saw','pilates-spine-stretch-forward','supported-shoulderstand');
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','glutes'] WHERE id IN ('bow-pose','locust-pose','thoracic-bridge','reverse-plank','reverse-tabletop-hold','pilates-leg-pull-back');
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','quads'] WHERE id='camel-pose';
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','triceps'] WHERE id='upward-dog';
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','chest'] WHERE id='fish-pose';
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','hamstrings'] WHERE id IN ('head-to-knee-pose','plow-pose','standing-forward-fold-to-half-lift');
UPDATE public.exercises SET muscles_detail=ARRAY['lower back','obliques'] WHERE id IN ('seated-spinal-twist','supine-spinal-twist');