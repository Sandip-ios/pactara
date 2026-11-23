# Builds the SQL that loads the RepDB free-tier library into public.exercises
# and links plan moves to it. Inputs: exercises.json from https://exercise-dataset.com/exercises.json
# (saved to /tmp/repdb/) and the image pointers in data/exercise-images/. Output: /tmp/repdb/seed.sql.
import json,os,sys
ex=json.load(open('/tmp/repdb/exercises.json'))['exercises']
ptr_dir='/dev-server/data/exercise-images'
def url(fn):
  p=os.path.join(ptr_dir,fn+'.asset.json')
  if not os.path.exists(p): raise SystemExit('missing '+fn)
  return json.load(open(p))['url']
M={'anterior_deltoid':'shoulders','lateral_deltoid':'shoulders','posterior_deltoid':'shoulders','supraspinatus':'shoulders','infraspinatus_teres_minor':'shoulders',
'pectoralis_major':'chest','serratus_anterior':'chest','latissimus_dorsi':'back','rhomboids':'back','erector_spinae':'back','quadratus_lumborum':'back',
'trapezius':'traps','biceps_brachii':'biceps','brachialis':'biceps','triceps_brachii':'triceps','forearm_flexors':'forearms','forearm_extensors':'forearms','brachioradialis':'forearms','forearms':'forearms',
'rectus_abdominis':'abs','obliques':'abs','transverse_abdominis':'abs','quadriceps':'quads','hip_flexors':'quads','adductors':'quads','hamstrings':'hamstrings',
'gluteus_maximus':'glutes','gluteus_medius':'glutes','abductors':'glutes','gastrocnemius':'calves','soleus':'calves','tibialis_anterior':'calves'}
MACHINE={'smith_machine','leg_press','hack_squat','leg_curl','leg_extension','pec_deck','glute_ham_developer','treadmill','elliptical','rower','air_bike','bicycle'}
def equip(e):
  v=e.get('equipment')
  if v=='dumbbell': return 'dumbbell'
  if v in ('barbell','ez_bar','trap_bar','plates'): return 'barbell' if v!='plates' else 'other'
  if v=='cable': return 'cable'
  if v=='kettlebell': return 'kettlebell'
  if v in ('resistance_band','loop_band'): return 'band'
  if v and ('machine' in v or v in MACHINE): return 'machine'
  if v is None or e.get('is_bodyweight'): return 'bodyweight'
  return 'other'
def regions(lst):
  out=[]
  for m in lst or []:
    r=M.get(m)
    if r and r not in out: out.append(r)
  return out
def q(s): return "'"+s.replace("'","''")+"'"
def arr(xs): return "ARRAY["+",".join(q(x) for x in xs)+"]::text[]" if xs else "'{}'::text[]"
rows=[]; unmapped=[]
for e in ex:
  pri=regions(e.get('primary_muscles'))
  sec=[r for r in regions(e.get('secondary_muscles')) if r not in pri]
  if not pri:
    pri=sec[:1]; sec=sec[1:]
  if not pri: unmapped.append(e['id'])
  name=e['name_en'].lower()
  timed = e['category'] in ('cardio','stretching') or e['force_type']=='static' or 'carry' in name or "farmer" in name
  imgs=e['images']['flat']
  start=url(os.path.basename(imgs.get('start') or imgs['main']))
  peak=url(os.path.basename(imgs['peak'])) if imgs.get('peak') else None
  rows.append(f"({q(e['id'])},{q(e['name_en'])},{arr(pri)},{arr(sec)},{q(equip(e))},{q(e['category'])},{q('timed' if timed else 'reps')},{arr(e.get('instructions_en') or [])},{q(start)},{q(peak) if peak else 'NULL'},'repdb')")
sql="INSERT INTO public.exercises (id,name,primary_muscles,secondary_muscles,equipment,category,log_type,instructions,image_start,image_peak,source) VALUES\n"+",\n".join(rows)+"\nON CONFLICT (id) DO NOTHING;\n"
MAP=[(None,'Banded glute bridge','banded-glute-bridge'),(None,'Banded kickback','glute-kickback'),(None,'Banded side walk','banded-lateral-walk'),
(None,'Bear crawl','bear-crawl'),(None,'Bear crawl hold','bear-plank-hold'),(None,'Bicep curl','bicep-curl'),(None,'Bird dog','bird-dog'),
(None,'Bodyweight squat','bodyweight-squat'),(None,'Brisk walk','walking'),(None,'Brisk walk warm-up','walking'),(None,'Easy walk','walking'),(None,'Walk','walking'),
(None,'Bulgarian split squat','bulgarian-split-squat'),('build-muscle','Calf raise','dumbbell-calf-raise'),('first-5k','Calf raise','bodyweight-calf-raise'),
(None,'Chair dip','bench-dips'),(None,'Clamshell','clamshells'),(None,'Close-grip push-up','close-grip-push-ups'),(None,'Dead bug','dead-bug'),
(None,'Dumbbell bench press','db-bench-press'),(None,'Dumbbell hip thrust','dumbbell-hip-thrust'),(None,'Dumbbell pullover','db-pullover'),
(None,'Dumbbell Romanian deadlift','dumbbell-romanian-deadlift'),(None,'Dumbbell row','bent-over-db-row'),(None,'One-arm dumbbell row','single-arm-db-row'),
(None,'Dumbbell shoulder press','dumbbell-shoulder-press'),(None,'Dumbbell sumo squat','db-sumo-squat'),(None,'Dumbbell thruster','thruster'),(None,'Squat to press','thruster'),
(None,'Easy run','running'),(None,'Run / walk','running'),(None,'Your 5K','running'),(None,'Farmer carry','dumbbell-farmers-walk'),
(None,'Glute bridge','glute-bridge'),(None,'Goblet squat','db-goblet-squat'),(None,'Hammer curl','hammer-curl'),(None,'High-knee march','high-knees'),
(None,'Incline dumbbell press','incline-db-press'),(None,'Incline push-up','incline-push-ups'),(None,'Jumping jack (or step jack)','jumping-jacks'),
(None,'Lateral raise','lateral-raise'),(None,'Mountain climber','mountain-climbers'),(None,'Mountain climber (slow)','mountain-climbers'),
(None,'Overhead triceps extension','overhead-tricep-extension'),(None,'Pike push-up','pike-push-ups'),(None,'Plank','plank'),
(None,'Push-up','push-up'),(None,'Push-up (incline if needed)','push-up'),(None,'Push-up (knees or incline OK)','push-up'),
(None,'Rear-delt fly','rear-delt-fly'),(None,'Renegade row (knees down OK)','renegade-row'),
('build-muscle','Reverse lunge','reverse-lunge'),('lose-fat','Reverse lunge','reverse-lunge'),('glute-builder','Reverse lunge','reverse-lunge'),('home-no-equipment','Reverse lunge','bodyweight-reverse-lunge'),('first-5k','Reverse lunge','bodyweight-reverse-lunge'),('walk-strength','Reverse lunge','bodyweight-reverse-lunge'),
(None,'Side plank','side-plank'),(None,'Single-leg glute bridge','single-leg-glute-bridge'),(None,'Single-leg hip thrust','single-leg-hip-thrust'),
(None,'Sit-to-stand from a chair','box-squat'),(None,'Split squat','dumbbell-split-squat'),(None,'Standing calf raise','bodyweight-calf-raise'),
(None,'Step-up','step-ups'),(None,'Superman','superman'),(None,'Wall push-up','wall-push-ups'),(None,'Wall sit','wall-sit')]
ids={e['id'] for e in ex}
for _,_,i in MAP: assert i in ids, i
vals=",\n".join(f"({q(s) if s else 'NULL'},{q(n)},{q(i)})" for s,n,i in MAP)
sql+=f"""
UPDATE public.plan_days d SET moves = sub.moves
FROM (
  SELECT d2.id, jsonb_agg(
    CASE WHEN mp.eid IS NULL THEN t.m ELSE t.m || jsonb_build_object('exercise_id', mp.eid) END
    ORDER BY t.ord) AS moves
  FROM public.plan_days d2
  JOIN public.plans p ON p.id = d2.plan_id
  CROSS JOIN LATERAL jsonb_array_elements(d2.moves) WITH ORDINALITY AS t(m, ord)
  LEFT JOIN LATERAL (
    SELECT v.eid FROM (VALUES
{vals}
    ) AS v(slug, name, eid)
    WHERE v.name = t.m->>'name' AND (v.slug IS NULL OR v.slug = p.slug)
    ORDER BY v.slug NULLS LAST LIMIT 1
  ) mp ON true
  GROUP BY d2.id
) sub
WHERE sub.id = d.id;
"""
open('/tmp/repdb/seed.sql','w').write(sql)
print(len(sql), 'unmapped', unmapped)
