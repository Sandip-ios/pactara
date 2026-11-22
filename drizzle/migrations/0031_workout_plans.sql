CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  goal text NOT NULL CHECK (goal IN ('muscle','fat_loss','glutes','beginner','home','run')),
  level text NOT NULL,
  weeks integer NOT NULL CHECK (weeks BETWEEN 1 AND 52),
  days_per_week integer NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  minutes text NOT NULL,
  gear text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  progression_rule text NOT NULL,
  safety_note text NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read published plans" ON public.plans
  FOR SELECT TO authenticated USING (is_published);

CREATE TABLE public.plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number >= 1),
  week_number integer CHECK (week_number >= 1),
  title text NOT NULL,
  minutes text,
  note text,
  moves jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plan_days_plan_day_week_key ON public.plan_days (plan_id, day_number, COALESCE(week_number, 0));
GRANT SELECT ON public.plan_days TO authenticated;
GRANT ALL ON public.plan_days TO service_role;
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read days of published plans" ON public.plan_days
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.is_published));

CREATE TABLE public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped')),
  current_week integer NOT NULL DEFAULT 1 CHECK (current_week >= 1),
  next_day integer NOT NULL DEFAULT 1 CHECK (next_day >= 1),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_plans_one_active_per_user ON public.user_plans (user_id) WHERE status = 'active';
CREATE INDEX user_plans_user_idx ON public.user_plans (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own plans" ON public.user_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users start their own plans" ON public.user_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own plans" ON public.user_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own plans" ON public.user_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_user_plan_position()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _weeks int; _days int;
BEGIN
  SELECT weeks, days_per_week INTO _weeks, _days FROM public.plans WHERE id = NEW.plan_id;
  IF NEW.current_week > _weeks THEN RAISE EXCEPTION 'current_week % is past the plan''s % weeks', NEW.current_week, _weeks; END IF;
  IF NEW.next_day > _days THEN RAISE EXCEPTION 'next_day % is past the plan''s % days', NEW.next_day, _days; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER user_plans_validate_position BEFORE INSERT OR UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_plan_position();

CREATE TABLE public.plan_workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_plan_id uuid NOT NULL REFERENCES public.user_plans(id) ON DELETE CASCADE,
  week integer NOT NULL CHECK (week >= 1),
  day_number integer NOT NULL CHECK (day_number >= 1),
  check_in_id uuid UNIQUE REFERENCES public.check_ins(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_workout_logs_user_plan_idx ON public.plan_workout_logs (user_plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_workout_logs TO authenticated;
GRANT ALL ON public.plan_workout_logs TO service_role;
ALTER TABLE public.plan_workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own plan workouts" ON public.plan_workout_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_plans up WHERE up.id = user_plan_id AND up.user_id = auth.uid()));
CREATE POLICY "Users log their own plan workouts" ON public.plan_workout_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_plans up WHERE up.id = user_plan_id AND up.user_id = auth.uid())
    AND (check_in_id IS NULL OR EXISTS (SELECT 1 FROM public.check_ins ci WHERE ci.id = check_in_id AND ci.user_id = auth.uid()))
  );
CREATE POLICY "Users update their own plan workouts" ON public.plan_workout_logs
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_plans up WHERE up.id = user_plan_id AND up.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_plans up WHERE up.id = user_plan_id AND up.user_id = auth.uid()));
CREATE POLICY "Users delete their own plan workouts" ON public.plan_workout_logs
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_plans up WHERE up.id = user_plan_id AND up.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.crew_active_plans()
RETURNS TABLE(user_id uuid, plan_slug text, plan_name text, current_week integer, weeks integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT up.user_id, p.slug, p.name, up.current_week, p.weeks
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.status = 'active'
    AND auth.uid() IS NOT NULL
    AND up.user_id <> auth.uid()
    AND public.shares_group_with(auth.uid(), up.user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.crew_active_plans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_active_plans() TO authenticated;

CREATE OR REPLACE FUNCTION public.plan_tags_for_check_ins(_check_in_ids uuid[])
RETURNS TABLE(check_in_id uuid, plan_name text, week integer, day_number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.check_in_id, p.name, l.week, l.day_number
  FROM public.plan_workout_logs l
  JOIN public.user_plans up ON up.id = l.user_plan_id
  JOIN public.plans p ON p.id = up.plan_id
  JOIN public.check_ins ci ON ci.id = l.check_in_id
  WHERE l.check_in_id = ANY(_check_in_ids)
    AND auth.uid() IS NOT NULL
    AND public.is_group_member(ci.group_id, auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.plan_tags_for_check_ins(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_tags_for_check_ins(uuid[]) TO authenticated;

INSERT INTO public.plans (slug, name, goal, level, weeks, days_per_week, minutes, gear, summary, progression_rule, note, sort_order, safety_note, is_published)
SELECT v.*, 'New to exercise, pregnant, or managing an injury or health condition? Check with a doctor before starting. Stop if anything hurts.', true FROM (VALUES
('build-muscle','Build Muscle','muscle','Beginner',8,5,'40',ARRAY['Pair of dumbbells','Bench or sturdy step']::text[],'Five dumbbell workouts a week to build strength and size, working a different area each day.','Start at the bottom of the rep range. Hit the top on every set? Go up 5 lb next time. Week 4 is lighter: 2 sets of everything.',NULL,1),
('lose-fat','Lose Fat','fat_loss','Beginner',6,5,'30',ARRAY['Light dumbbells or water bottles']::text[],'Simple strength days, short circuits and a brisk walk to burn fat while keeping your muscle.','Add 1 round to each circuit in weeks 3 and 5. Add 5 min to the walk each week, up to 40.',NULL,2),
('glute-builder','Glute Builder','glutes','Beginner–intermediate',6,4,'40',ARRAY['Dumbbells','Mini band','Bench']::text[],'Four workouts a week built around hip thrusts, squats and band work for stronger glutes.','Add 2 reps a week until the top of the range, then add 5-10 lb and drop back to the bottom.','On a 5-day crew rule the 5th day is free choice.',3),
('walk-strength','Walk + Strength','beginner','Total beginner',4,5,'20–35',ARRAY['A chair','A wall']::text[],'Gentle walks and easy strength moves to get your body used to moving again.','Add 1 rep to each strength move and 5 minutes to each walk every week.',NULL,4),
('home-no-equipment','Home, No Equipment','home','Beginner',6,5,'25','{}'::text[],'Bodyweight workouts you can do in your living room, with nothing to buy.','Every 2 weeks, move one step harder on each move.',NULL,5),
('first-5k','Run Your First 5K','run','Beginner',8,5,'25–35',ARRAY['Running shoes']::text[],'Go from short run/walk intervals to running a full 5K in 8 weeks.','Each week the runs get a little longer and the walks a little shorter.','Repeating a week is fine.',6)
) AS v(slug, name, goal, level, weeks, days_per_week, minutes, gear, summary, progression_rule, note, sort_order);

WITH plain(name, plain) AS (VALUES
('Banded glute bridge','With a mini band just above your knees, press your knees out and lift your hips into a bridge.'),
('Banded kickback','On your hands and knees with a band around your legs, push one leg back and up, squeezing your glutes.'),
('Banded side walk','With a mini band above your knees and your knees slightly bent, take small steps sideways.'),
('Bear crawl','On your hands and feet with knees just off the floor, crawl forward and back in small steps.'),
('Bear crawl hold','On your hands and knees, lift your knees an inch off the floor and hold with a flat back.'),
('Bicep curl','Hold the dumbbells with palms facing forward, curl them up to your shoulders, then lower slowly.'),
('Bird dog','On your hands and knees, reach one arm forward and the opposite leg back, hold for a breath, then switch.'),
('Bodyweight squat','Stand with feet shoulder-width apart, sit your hips back and down, then stand up.'),
('Brisk walk','Walk at a pace where you can still talk but couldn''t sing.'),
('Brisk walk warm-up','Walk briskly for 5 minutes to warm up before you start running.'),
('Bulgarian split squat','Rest your back foot on a bench, lower your back knee toward the floor, then push up through your front foot.'),
('Calf raise','Stand tall, rise up onto your toes, pause, then lower your heels slowly.'),
('Chair dip','With your hands on the edge of a chair behind you, bend your elbows to lower your hips, then push back up.'),
('Clamshell','Lie on your side with knees bent and a band above them, open your top knee like a clamshell, then close it slowly.'),
('Close-grip push-up','Do a push-up with your hands a little closer than your shoulders and your elbows tucked in by your sides.'),
('Dead bug','Lie on your back with arms up and knees bent, then slowly lower the opposite arm and leg while keeping your lower back on the floor.'),
('Dumbbell Romanian deadlift','Hold the dumbbells in front of your thighs, push your hips back with a flat back until the backs of your legs stretch, then stand tall.'),
('Dumbbell bench press','Lie on a bench with a dumbbell in each hand at chest level, press them straight up, then lower them slowly.'),
('Dumbbell hip thrust','Sit with your upper back against a bench and a dumbbell on your hips, push your hips up until your body is flat, then lower.'),
('Dumbbell pullover','Lie on a bench holding one dumbbell over your chest, lower it behind your head with soft elbows, then bring it back up.'),
('Dumbbell row','Lean forward with a flat back and pull the dumbbell up toward your hip, then lower it slowly.'),
('Dumbbell shoulder press','Hold the dumbbells at your shoulders, push them straight overhead, then lower them back down.'),
('Dumbbell sumo squat','Stand with your feet wide and toes turned out, hold one dumbbell between your legs and squat down and up.'),
('Dumbbell thruster','Hold the dumbbells at your shoulders, squat down, then stand up and press them overhead in one smooth move.'),
('Easy run','Run at a slow, easy pace where you could still talk; walk for a bit if you need to.'),
('Easy walk','Walk at a relaxed, comfortable pace the whole time.'),
('Farmer carry','Hold a heavy dumbbell in each hand, stand tall and walk steadily until the time is up.'),
('Frog pump','Lie on your back with the soles of your feet together and knees out, then squeeze your glutes to lift your hips.'),
('Glute bridge','Lie on your back with knees bent, squeeze your glutes and lift your hips until your body is straight, then lower.'),
('Glute bridge march','Hold a glute bridge and lift one foot a little off the floor at a time without letting your hips drop.'),
('Goblet squat','Hold one dumbbell at your chest, sit your hips down as low as feels comfortable, then stand back up.'),
('Guided stretch','Gently stretch your hips, hamstrings, chest and back, holding each stretch for about 30 seconds without bouncing.'),
('Hammer curl','Hold the dumbbells with palms facing each other, curl them up to your shoulders, then lower slowly.'),
('High-knee march','March in place, lifting each knee up to hip height and swinging your arms.'),
('Incline dumbbell press','Lie on a bench propped up at an angle and press the dumbbells up from your upper chest, then lower slowly.'),
('Incline push-up','Put your hands on a bench or step, keep your body straight, lower your chest toward it, then push back up.'),
('Jumping jack (or step jack)','Jump your feet out as your arms go overhead, then back in; step side to side instead for a gentler version.'),
('Lateral raise','Hold light dumbbells at your sides and lift them out to shoulder height, then lower them slowly.'),
('Mountain climber','From the top of a push-up, bring one knee toward your chest at a time at a steady pace.'),
('Mountain climber (slow)','From the top of a push-up, bring one knee toward your chest at a time at a slow, steady pace.'),
('One-arm dumbbell row','With one hand and knee on a bench, pull the dumbbell up toward your hip, then lower it slowly.'),
('Overhead triceps extension','Hold one dumbbell overhead with both hands, bend your elbows to lower it behind your head, then straighten your arms.'),
('Pike push-up','With your hips high in an upside-down V, bend your elbows to lower your head toward the floor, then push back up.'),
('Plank','Hold your body in a straight line on your forearms and toes, keeping your belly tight.'),
('Plank shoulder tap','In a push-up position, tap one shoulder with the opposite hand at a time while keeping your hips still.'),
('Push-up','Lower your chest toward the floor with your body straight, then push back up.'),
('Push-up (incline if needed)','Lower your chest toward the floor with your body straight, then push back up; put your hands on a bench or wall to make it easier.'),
('Push-up (knees or incline OK)','Lower your chest toward the floor with your body straight, then push back up; drop to your knees or use a bench to make it easier.'),
('Rear-delt fly','Lean forward with a flat back and lift light dumbbells out to the sides, squeezing your shoulder blades together.'),
('Renegade row (knees down OK)','In a push-up position with your hands on the dumbbells, pull one up to your ribs at a time while keeping your hips still.'),
('Reverse lunge','Step one foot back and lower your back knee toward the floor, then push through your front foot to stand.'),
('Run / walk','Switch between running and walking as listed, running at a pace where you could still talk.'),
('Side plank','Lie on your side and lift your hips so your body is straight from head to feet, resting on your forearm.'),
('Single-leg glute bridge','Lie on your back with one foot on the floor and the other leg lifted, push your hips up, then lower.'),
('Single-leg hip thrust','With your upper back on a bench and one foot on the floor, push that hip up until your body is flat, then lower.'),
('Sit-to-stand from a chair','Sit on the front of a chair, stand all the way up without using your hands, then sit back down slowly.'),
('Skater step','Step wide to one side and swing your other leg behind you, then switch sides like a speed skater.'),
('Split squat','Stand with one foot forward and one back, lower your back knee toward the floor, then push back up without moving your feet.'),
('Squat to press','Squat down holding the dumbbells at your shoulders, then stand up and press them overhead.'),
('Squat to reach','Squat down, then stand up and reach both arms overhead.'),
('Standing calf raise','Hold a wall or chair for balance, rise up onto your toes, then lower slowly.'),
('Step-up','Step up onto a bench or step with one foot, stand tall at the top, then step back down with control.'),
('Superman','Lie face down and lift your arms, chest and legs a little off the floor, then lower them.'),
('Walk','Walk at a steady pace you could keep up while chatting.'),
('Wall push-up','Put your hands on a wall at shoulder height, lean in until your nose nearly touches it, then push back.'),
('Wall sit','Lean your back on a wall and slide down until your knees are bent like you''re sitting on a chair, then hold.'),
('Your 5K','Run 5K at an easy, steady pace; finishing is the goal, not speed.')
),
raw(slug, day_number, week_number, title, minutes, note, moves) AS (VALUES
('build-muscle',1,NULL,'Push: chest + shoulders',NULL,NULL,'[["Dumbbell bench press", "3x8-12"], ["Dumbbell shoulder press", "3x8-12"], ["Incline push-up", "2x10-15"], ["Lateral raise", "2x12-15"], ["Overhead triceps extension", "2x10-12"]]'),
('build-muscle',2,NULL,'Legs',NULL,NULL,'[["Goblet squat", "3x8-12"], ["Dumbbell Romanian deadlift", "3x8-12"], ["Reverse lunge", "2x8 each leg"], ["Glute bridge", "2x12-15"], ["Calf raise", "2x15"]]'),
('build-muscle',3,NULL,'Pull: back + arms',NULL,NULL,'[["One-arm dumbbell row", "3x8-12 each side"], ["Rear-delt fly", "2x12-15"], ["Dumbbell pullover", "2x10-12"], ["Hammer curl", "3x10-12"], ["Dead bug", "2x8 each side"]]'),
('build-muscle',4,NULL,'Full body',NULL,NULL,'[["Incline dumbbell press", "3x8-12"], ["Split squat", "3x8 each leg"], ["Dumbbell row", "3x10"], ["Farmer carry", "3x30 sec"], ["Plank", "3x30 sec"]]'),
('build-muscle',5,NULL,'Glutes + arms',NULL,NULL,'[["Step-up", "3x8 each leg"], ["Dumbbell hip thrust", "3x10-12"], ["Bicep curl", "2x12"], ["Close-grip push-up", "2 sets, stop 2 reps short"], ["Side plank", "2x20 sec each side"]]'),
('lose-fat',1,NULL,'Strength A',NULL,NULL,'[["Goblet squat", "3x10"], ["Dumbbell row", "3x10 each side"], ["Push-up (incline if needed)", "3x8-12"], ["Glute bridge", "3x12"]]'),
('lose-fat',2,NULL,'Circuit',NULL,'4 rounds, 40 sec on / 20 sec off','[["Step-up", "40 sec on / 20 sec off"], ["Mountain climber (slow)", "40 sec on / 20 sec off"], ["Dumbbell thruster", "40 sec on / 20 sec off"], ["High-knee march", "40 sec on / 20 sec off"]]'),
('lose-fat',3,NULL,'Strength B',NULL,NULL,'[["Dumbbell Romanian deadlift", "3x10"], ["Dumbbell shoulder press", "3x10"], ["Reverse lunge", "3x8 each leg"], ["Dead bug", "3x8 each side"]]'),
('lose-fat',4,NULL,'Brisk walk + core',NULL,NULL,'[["Brisk walk", "20 min"], ["Plank", "3x30 sec"], ["Side plank", "2x20 sec each side"]]'),
('lose-fat',5,NULL,'Circuit',NULL,'4 rounds, 40 sec on / 20 sec off','[["Squat to press", "40 sec on / 20 sec off"], ["Renegade row (knees down OK)", "40 sec on / 20 sec off"], ["Skater step", "40 sec on / 20 sec off"], ["Bear crawl hold", "40 sec on / 20 sec off"]]'),
('glute-builder',1,NULL,'Glutes + hamstrings',NULL,NULL,'[["Dumbbell hip thrust", "4x10-12"], ["Dumbbell Romanian deadlift", "3x10"], ["Banded glute bridge", "2x15"], ["Banded side walk", "2x12 steps each way"]]'),
('glute-builder',2,NULL,'Upper body',NULL,NULL,'[["Dumbbell row", "3x10"], ["Dumbbell shoulder press", "3x10"], ["Incline push-up", "3x8-12"], ["Plank", "3x30 sec"]]'),
('glute-builder',3,NULL,'Glutes + quads',NULL,NULL,'[["Goblet squat", "3x10"], ["Bulgarian split squat", "3x8 each leg"], ["Step-up", "2x10 each leg"], ["Frog pump", "2x20"]]'),
('glute-builder',4,NULL,'Glute burnout',NULL,NULL,'[["Single-leg hip thrust", "3x10 each side"], ["Dumbbell sumo squat", "3x12"], ["Banded kickback", "2x15 each side"], ["Clamshell", "2x15 each side"]]'),
('walk-strength',1,NULL,'Walk','20',NULL,'[["Easy walk", "20 min"]]'),
('walk-strength',2,NULL,'Easy strength','20',NULL,'[["Sit-to-stand from a chair", "2x8"], ["Wall push-up", "2x8"], ["Glute bridge", "2x10"], ["Standing calf raise", "2x10"], ["Bird dog", "2x6 each side"]]'),
('walk-strength',3,NULL,'Walk','20',NULL,'[["Walk", "20 min, last 5 min a little faster"]]'),
('walk-strength',4,NULL,'Easy strength','20',NULL,'[["Sit-to-stand from a chair", "2x8"], ["Wall push-up", "2x8"], ["Glute bridge", "2x10"], ["Standing calf raise", "2x10"], ["Bird dog", "2x6 each side"]]'),
('walk-strength',5,NULL,'Long walk','25',NULL,'[["Walk", "25 min"]]'),
('home-no-equipment',1,NULL,'Upper body',NULL,NULL,'[["Push-up (knees or incline OK)", "3 sets, stop 2 reps short"], ["Pike push-up", "2x6-8"], ["Chair dip", "2x8-10"], ["Superman", "3x10"]]'),
('home-no-equipment',2,NULL,'Lower body',NULL,NULL,'[["Bodyweight squat", "3x15"], ["Reverse lunge", "3x10 each leg"], ["Single-leg glute bridge", "3x10 each side"], ["Wall sit", "2x30 sec"]]'),
('home-no-equipment',3,NULL,'Core + cardio',NULL,'4 rounds, 30 sec on / 30 sec off','[["Mountain climber", "30 sec on / 30 sec off"], ["Plank shoulder tap", "30 sec on / 30 sec off"], ["Jumping jack (or step jack)", "30 sec on / 30 sec off"], ["Dead bug", "30 sec on / 30 sec off"]]'),
('home-no-equipment',4,NULL,'Full body',NULL,NULL,'[["Squat to reach", "3x12"], ["Push-up", "3 sets, stop 2 reps short"], ["Glute bridge march", "3x10 each side"], ["Bear crawl", "3x20 sec"]]'),
('home-no-equipment',5,NULL,'Stretch + walk',NULL,NULL,'[["Walk", "15 min"], ["Guided stretch", "10 min (hips, hamstrings, chest, back)"]]'),
('first-5k',2,NULL,'Runner''s strength','20',NULL,'[["Bodyweight squat", "3x12"], ["Reverse lunge", "2x8 each leg"], ["Glute bridge", "3x12"], ["Calf raise", "3x15"], ["Plank", "3x30 sec"]]'),
('first-5k',4,NULL,'Runner''s strength','20',NULL,'[["Bodyweight squat", "3x12"], ["Reverse lunge", "2x8 each leg"], ["Glute bridge", "3x12"], ["Calf raise", "3x15"], ["Plank", "3x30 sec"]]'),
('first-5k',1,1,'Run','25',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "8 rounds: run 1 min / walk 90 sec"]]'),
('first-5k',3,1,'Run','25',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "8 rounds: run 1 min / walk 90 sec"]]'),
('first-5k',5,1,'Run','25',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "8 rounds: run 1 min / walk 90 sec"]]'),
('first-5k',1,2,'Run','26',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "6 rounds: run 90 sec / walk 2 min"]]'),
('first-5k',3,2,'Run','26',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "6 rounds: run 90 sec / walk 2 min"]]'),
('first-5k',5,2,'Run','26',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "6 rounds: run 90 sec / walk 2 min"]]'),
('first-5k',1,3,'Run','23',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "2 rounds: run 90 sec, walk 90 sec, run 3 min, walk 3 min"]]'),
('first-5k',3,3,'Run','23',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "2 rounds: run 90 sec, walk 90 sec, run 3 min, walk 3 min"]]'),
('first-5k',5,3,'Run','23',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "2 rounds: run 90 sec, walk 90 sec, run 3 min, walk 3 min"]]'),
('first-5k',1,4,'Run','27',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 3, walk 1.5, run 5, walk 2.5, run 3, walk 1.5, run 5 (minutes)"]]'),
('first-5k',3,4,'Run','27',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 3, walk 1.5, run 5, walk 2.5, run 3, walk 1.5, run 5 (minutes)"]]'),
('first-5k',5,4,'Run','27',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 3, walk 1.5, run 5, walk 2.5, run 3, walk 1.5, run 5 (minutes)"]]'),
('first-5k',1,5,'Run','26',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 8, walk 5, run 8 (minutes)"]]'),
('first-5k',3,5,'Run','26',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 8, walk 5, run 8 (minutes)"]]'),
('first-5k',5,5,'Run','26',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 8, walk 5, run 8 (minutes)"]]'),
('first-5k',1,6,'Run','28',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 10, walk 3, run 10 (minutes)"]]'),
('first-5k',3,6,'Run','28',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 10, walk 3, run 10 (minutes)"]]'),
('first-5k',5,6,'Run','28',NULL,'[["Brisk walk warm-up", "5 min"], ["Run / walk", "Run 10, walk 3, run 10 (minutes)"]]'),
('first-5k',1,7,'Run','30',NULL,'[["Brisk walk warm-up", "5 min"], ["Easy run", "Run 25 min easy"]]'),
('first-5k',3,7,'Run','30',NULL,'[["Brisk walk warm-up", "5 min"], ["Easy run", "Run 25 min easy"]]'),
('first-5k',5,7,'Run','30',NULL,'[["Brisk walk warm-up", "5 min"], ["Easy run", "Run 25 min easy"]]'),
('first-5k',1,8,'Run','33',NULL,'[["Brisk walk warm-up", "5 min"], ["Easy run", "Run 28 min"]]'),
('first-5k',3,8,'Run','33',NULL,'[["Brisk walk warm-up", "5 min"], ["Easy run", "Run 28 min"]]'),
('first-5k',5,8,'Your 5K','35',NULL,'[["Brisk walk warm-up", "5 min"], ["Your 5K", "~30 min"]]')
)
INSERT INTO public.plan_days (plan_id, day_number, week_number, title, minutes, note, moves)
SELECT p.id, r.day_number, r.week_number::int, r.title, r.minutes, r.note,
  (SELECT jsonb_agg(jsonb_build_object('name', x.e->>0, 'dose', x.e->>1, 'plain', pl.plain) ORDER BY x.ord)
     FROM jsonb_array_elements(r.moves::jsonb) WITH ORDINALITY AS x(e, ord)
     JOIN plain pl ON pl.name = x.e->>0)
FROM raw r JOIN public.plans p ON p.slug = r.slug;