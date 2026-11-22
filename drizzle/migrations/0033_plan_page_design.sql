ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS cover_credit text,
  ADD COLUMN IF NOT EXISTS focus_line text,
  ADD COLUMN IF NOT EXISTS gear_short text,
  ADD COLUMN IF NOT EXISTS week_notes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.plan_days
  ADD COLUMN IF NOT EXISTS muscles jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.plans SET
  cover_url = 'https://images.unsplash.com/photo-1674834727149-00812f907676?w=1200&q=70&fit=crop&auto=format',
  cover_credit = 'Ambitious Studio / Rick Barrett',
  focus_line = 'Full body, every muscle twice a week',
  gear_short = 'Dumbbells + bench',
  week_notes = '[
    {"week":1,"emoji":"🌱","title":"Learn the moves","note":"Light weights. Get the form right before adding weight.","lighter":false},
    {"week":2,"emoji":"➕","title":"One more rep","note":"Same weights, one more rep where you can.","lighter":false},
    {"week":3,"emoji":"📈","title":"First weight jump","note":"Hit the top of the range on every set? Add 5 lb.","lighter":false},
    {"week":4,"emoji":"🌙","title":"Lighter week","note":"2 sets of everything so your body catches up.","lighter":true},
    {"week":5,"emoji":"💪","title":"Back to work","note":"3 sets again, a little heavier than week 3.","lighter":false},
    {"week":6,"emoji":"📈","title":"Keep climbing","note":"Add reps, then weight.","lighter":false},
    {"week":7,"emoji":"🔥","title":"Your heaviest week","note":"Most people notice real changes by now.","lighter":false},
    {"week":8,"emoji":"🏆","title":"Then vs now","note":"Repeat Day 1 and compare it to week 1.","lighter":false}
  ]'::jsonb
WHERE slug = 'build-muscle';

UPDATE public.plans SET
  cover_url = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=70&fit=crop&auto=format',
  cover_credit = 'Jonathan Borba',
  focus_line = 'Full body strength plus heart-pumping circuits',
  gear_short = 'Light dumbbells',
  week_notes = '[
    {"week":1,"emoji":"🌱","title":"Find your pace","note":"4 rounds per circuit and a 20 min walk.","lighter":false},
    {"week":2,"emoji":"🚶","title":"Walk a bit longer","note":"Same circuits, walk 25 min.","lighter":false},
    {"week":3,"emoji":"➕","title":"One more round","note":"5 rounds per circuit, walk 30 min.","lighter":false},
    {"week":4,"emoji":"📈","title":"Settle in","note":"Same rounds, walk 35 min.","lighter":false},
    {"week":5,"emoji":"🔥","title":"Another round","note":"6 rounds per circuit, walk 40 min.","lighter":false},
    {"week":6,"emoji":"🏆","title":"Finish strong","note":"Same as week 5. Notice how much easier it feels.","lighter":false}
  ]'::jsonb
WHERE slug = 'lose-fat';

UPDATE public.plans SET
  cover_url = 'https://images.unsplash.com/photo-1649887974297-4be052375a67?w=1200&q=70&fit=crop&auto=format',
  cover_credit = 'SUNDAY II SUNDAY',
  focus_line = 'Glutes first, with legs and upper body in support',
  gear_short = 'Dumbbells + band',
  week_notes = '[
    {"week":1,"emoji":"🌱","title":"Learn the moves","note":"Start at the bottom of each rep range.","lighter":false},
    {"week":2,"emoji":"➕","title":"Two more reps","note":"Same weights, 2 more reps per set.","lighter":false},
    {"week":3,"emoji":"➕","title":"Keep adding reps","note":"2 more again where you can.","lighter":false},
    {"week":4,"emoji":"📈","title":"First weight jump","note":"At the top of the range? Add 5-10 lb and start low again.","lighter":false},
    {"week":5,"emoji":"💪","title":"Build back up","note":"Add 2 reps a set with the new weight.","lighter":false},
    {"week":6,"emoji":"🏆","title":"Your strongest week","note":"Go for the top of every range.","lighter":false}
  ]'::jsonb
WHERE slug = 'glute-builder';

UPDATE public.plans SET
  cover_url = 'https://images.unsplash.com/photo-1691605085147-646fd8059b6d?w=1200&q=70&fit=crop&auto=format',
  cover_credit = 'Lala Azizli',
  focus_line = 'Gentle full body, mostly legs',
  gear_short = 'Chair + wall',
  week_notes = '[
    {"week":1,"emoji":"🌱","title":"Get started","note":"Easy walks and gentle strength moves.","lighter":false},
    {"week":2,"emoji":"➕","title":"A little more","note":"1 more rep on each move, 5 more min on each walk.","lighter":false},
    {"week":3,"emoji":"📈","title":"Building up","note":"1 more rep again, 5 more min again.","lighter":false},
    {"week":4,"emoji":"🏆","title":"Your longest week","note":"Your longest walks yet. Look how far you have come.","lighter":false}
  ]'::jsonb
WHERE slug = 'walk-strength';

UPDATE public.plans SET
  cover_url = 'https://images.unsplash.com/photo-1714646442330-9068099f5521?w=1200&q=70&fit=crop&auto=format',
  cover_credit = 'Vitaly Gariev',
  focus_line = 'Full body with just your bodyweight',
  gear_short = 'No equipment',
  week_notes = '[
    {"week":1,"emoji":"🌱","title":"Learn the moves","note":"Use the easiest version that feels solid.","lighter":false},
    {"week":2,"emoji":"➕","title":"Own it","note":"Same moves, smoother and steadier.","lighter":false},
    {"week":3,"emoji":"📈","title":"One step harder","note":"Move to the next version of each move, like knee to full push-ups.","lighter":false},
    {"week":4,"emoji":"💪","title":"Settle in","note":"Same versions as week 3, cleaner reps.","lighter":false},
    {"week":5,"emoji":"📈","title":"Another step up","note":"Move one step harder again.","lighter":false},
    {"week":6,"emoji":"🏆","title":"Then vs now","note":"Compare to week 1. Notice what feels easy now.","lighter":false}
  ]'::jsonb
WHERE slug = 'home-no-equipment';

UPDATE public.plans SET
  cover_url = 'https://images.unsplash.com/photo-1603455778956-d71832eafa4e?w=1200&q=70&fit=crop&auto=format',
  cover_credit = 'McCarthy Beckan',
  focus_line = 'Legs and lungs, plus strength to stay injury-free',
  gear_short = 'Running shoes',
  week_notes = '[
    {"week":1,"emoji":"🌱","title":"Run 1, walk 90","note":"8 rounds: run 1 min, walk 90 sec.","lighter":false},
    {"week":2,"emoji":"➕","title":"Run 90 seconds","note":"6 rounds: run 90 sec, walk 2 min.","lighter":false},
    {"week":3,"emoji":"📈","title":"First 3-minute run","note":"Twice: run 90 sec, walk 90 sec, run 3 min, walk 3 min.","lighter":false},
    {"week":4,"emoji":"💪","title":"First 5-minute run","note":"Run 3, walk 1.5, run 5, walk 2.5, run 3, walk 1.5, run 5 (min).","lighter":false},
    {"week":5,"emoji":"🔥","title":"Run 8 minutes","note":"Run 8 min, walk 5, run 8.","lighter":false},
    {"week":6,"emoji":"📈","title":"Run 10 minutes","note":"Run 10 min, walk 3, run 10.","lighter":false},
    {"week":7,"emoji":"🏃","title":"Run 25 minutes","note":"One steady, easy 25 min run.","lighter":false},
    {"week":8,"emoji":"🏆","title":"Your 5K","note":"Run 28 min. The last run of the week is your 5K.","lighter":false}
  ]'::jsonb
WHERE slug = 'first-5k';

UPDATE public.plan_days d SET muscles = v.m::jsonb
FROM public.plans p, (VALUES
  ('build-muscle',1,'{"chest":2,"shoulders":2,"triceps":2,"abs":1}'),
  ('build-muscle',2,'{"quads":2,"glutes":2,"hamstrings":2,"calves":2,"abs":1}'),
  ('build-muscle',3,'{"back":2,"traps":1,"biceps":2,"forearms":1,"shoulders":1,"abs":1}'),
  ('build-muscle',4,'{"chest":1,"back":1,"quads":2,"glutes":1,"abs":2,"forearms":2,"shoulders":1}'),
  ('build-muscle',5,'{"glutes":2,"quads":1,"hamstrings":1,"biceps":2,"triceps":2,"abs":1}'),
  ('lose-fat',1,'{"quads":2,"glutes":2,"back":2,"chest":2,"hamstrings":1,"biceps":1,"triceps":1,"shoulders":1,"abs":1}'),
  ('lose-fat',2,'{"quads":2,"glutes":2,"shoulders":2,"abs":2,"hamstrings":1,"calves":1,"triceps":1}'),
  ('lose-fat',3,'{"hamstrings":2,"glutes":2,"shoulders":2,"quads":2,"abs":2,"triceps":1,"traps":1}'),
  ('lose-fat',4,'{"abs":2,"quads":1,"hamstrings":1,"glutes":1,"calves":1,"shoulders":1}'),
  ('lose-fat',5,'{"quads":2,"shoulders":2,"back":2,"glutes":2,"abs":2,"chest":1,"triceps":1,"biceps":1,"calves":1}'),
  ('glute-builder',1,'{"glutes":2,"hamstrings":2,"quads":1,"forearms":1}'),
  ('glute-builder',2,'{"back":2,"shoulders":2,"chest":2,"biceps":1,"triceps":1,"traps":1,"abs":1}'),
  ('glute-builder',3,'{"quads":2,"glutes":2,"hamstrings":1,"abs":1}'),
  ('glute-builder',4,'{"glutes":2,"quads":1,"hamstrings":1}'),
  ('walk-strength',1,'{"quads":2,"calves":2,"glutes":1,"hamstrings":1}'),
  ('walk-strength',2,'{"quads":2,"chest":2,"glutes":2,"calves":2,"hamstrings":1,"shoulders":1,"triceps":1,"back":1,"abs":1}'),
  ('walk-strength',3,'{"quads":2,"calves":2,"glutes":1,"hamstrings":1}'),
  ('walk-strength',4,'{"quads":2,"chest":2,"glutes":2,"calves":2,"hamstrings":1,"shoulders":1,"triceps":1,"back":1,"abs":1}'),
  ('walk-strength',5,'{"quads":2,"calves":2,"glutes":1,"hamstrings":1}'),
  ('home-no-equipment',1,'{"chest":2,"shoulders":2,"triceps":2,"back":2,"abs":1,"glutes":1}'),
  ('home-no-equipment',2,'{"quads":2,"glutes":2,"hamstrings":1,"calves":1}'),
  ('home-no-equipment',3,'{"abs":2,"shoulders":1,"quads":1,"calves":1}'),
  ('home-no-equipment',4,'{"quads":2,"glutes":2,"chest":2,"abs":1,"shoulders":1,"triceps":1,"hamstrings":1}'),
  ('home-no-equipment',5,'{"quads":1,"hamstrings":1,"glutes":1,"calves":1,"chest":1,"back":1}'),
  ('first-5k',1,'{"quads":2,"calves":2,"hamstrings":2,"glutes":1,"abs":1}'),
  ('first-5k',2,'{"quads":2,"glutes":2,"calves":2,"hamstrings":1,"abs":1}'),
  ('first-5k',3,'{"quads":2,"calves":2,"hamstrings":2,"glutes":1,"abs":1}'),
  ('first-5k',4,'{"quads":2,"glutes":2,"calves":2,"hamstrings":1,"abs":1}'),
  ('first-5k',5,'{"quads":2,"calves":2,"hamstrings":2,"glutes":1,"abs":1}')
) AS v(slug, day, m)
WHERE p.slug = v.slug AND d.plan_id = p.id AND d.day_number = v.day;

CREATE OR REPLACE FUNCTION public.crew_on_plan(_plan_id uuid)
RETURNS TABLE(user_id uuid, status text, current_week integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (up.user_id) up.user_id, up.status, up.current_week
  FROM public.user_plans up
  WHERE up.plan_id = _plan_id
    AND up.status IN ('active', 'completed')
    AND auth.uid() IS NOT NULL
    AND up.user_id <> auth.uid()
    AND public.shares_group_with(auth.uid(), up.user_id)
  ORDER BY up.user_id, (up.status = 'completed') DESC, up.created_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.crew_on_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_on_plan(uuid) TO authenticated;