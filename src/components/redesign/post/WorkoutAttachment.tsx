import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Dumbbell, Minus, Plus, Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExerciseThumb } from '@/components/workout/WorkoutBits';
import { searchPostExercises } from '@/lib/posts.functions';
import type { PostWorkoutChoice } from '@/lib/social-post-types';
import { NewSheet, NewSheetChip, NewSheetRow } from '../NewSheet';
import { SheetActions, type useComposeContext } from './ComposeParts';
export type CaptionMove = { exerciseId: string; name: string; imageStart: string | null; sets: number; reps: number };
type Context = ReturnType<typeof useComposeContext>['data'];

/** Workout is independent of any future meal attachment. Suggestions never auto-attach. */
export function WorkoutAttachment({ ctx, suggestions, workout, onChange }: { ctx: Context; suggestions: CaptionMove[]; workout: PostWorkoutChoice; onChange: (w: PostWorkoutChoice) => void }) {
  const [pick, setPick] = useState(false);
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const [moves, setMoves] = useState<CaptionMove[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'session' | 'saved'>('session');
  const [exerciseQuery, setExerciseQuery] = useState('');
  const exercises = useQuery({ queryKey: ['post-exercise-search', exerciseQuery], queryFn: () => searchPostExercises({ data: { query: exerciseQuery } }), enabled: add });
  const selected = workout && workout.source !== 'caption' ? (workout.source === 'session' ? ctx?.sessions : ctx?.saved)?.find(w => w.id === workout.id) : null;
  const title = workout?.source === 'caption' ? 'From your caption' : selected?.title ?? 'Workout';
  const count = workout?.source === 'caption' ? workout.moves.length : selected?.exercises ?? 0;
  const sets = workout?.source === 'caption' ? workout.moves.reduce((n,m) => n + m.sets, 0) : selected?.sets ?? 0;
  const minutes = selected && 'minutes' in selected && typeof selected.minutes === 'number' ? selected.minutes : 0;
  const rows = source === 'session' ? (ctx?.sessions ?? []).map(w => ({ ...w, dateLabel: new Date(w.loggedAt).toDateString() === new Date().toDateString() ? 'Today' : new Date(w.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })) : (ctx?.saved ?? []).map(w => ({ ...w, minutes: 0, dateLabel: '' }));
  const openEdit = () => { if (workout?.source === 'caption') setMoves(workout.moves.map(m => ({...m}))); setEdit(true); };
  const update = (i: number, key: 'sets' | 'reps', value: number) => setMoves(ms => ms.map((m,j) => j === i ? {...m,[key]: value} : m));
  return <section className="mx-4 mt-3 text-[var(--new-ink)]">
    {!workout && suggestions.length > 0 && <div className="mb-3 flex items-center gap-2.5 rounded-[14px] bg-[var(--new-soft)] p-3">
      <Sparkles size={20} className="shrink-0 text-[var(--new-purple)]" />
      <div className="min-w-0 flex-1"><div className="text-[14px] font-bold">We found {suggestions.length} {suggestions.length === 1 ? 'exercise' : 'exercises'} in your caption</div><div className="mt-0.5 text-[12px] text-[var(--new-muted)]">{suggestions.map(m=>m.name).join(', ')}</div></div>
      <Button onClick={() => onChange({source:'caption',moves:suggestions.map(m=>({...m}))})} className="h-8 rounded-full bg-[var(--new-purple)] px-3 text-[13px] font-bold text-[var(--new-white)] hover:bg-[var(--new-purple)]">Attach</Button>
    </div>}
    {workout ? <div className="flex items-center gap-2 rounded-[16px] bg-[var(--new-post-attachment)] p-3.5">
      <div className="min-w-0 flex-1"><div className="text-[11px] font-extrabold text-[var(--new-purple)]">WORKOUT</div><div className="mt-0.5 text-[16px] font-bold">{title}</div><div className="text-[13px] text-[var(--new-muted)]">{count} exercises · {sets} sets{minutes > 0 ? ` · ${minutes} min` : ''}</div></div>
      <Button variant="ghost" onClick={workout.source === 'caption' ? openEdit : ()=>setPick(true)} className="h-10 px-1 text-[13px] font-bold text-[var(--new-purple)]">{workout.source === 'caption' ? 'Edit' : 'Change'}</Button>
      <Button variant="ghost" aria-label="Remove workout" onClick={()=>onChange(null)} className="h-10 w-9 shrink-0 px-0"><X size={18}/></Button>
    </div> : <div className="rounded-[16px] bg-[var(--new-profile-surface)] px-3.5"><Button variant="ghost" onClick={()=>setPick(true)} className="h-[56px] w-full justify-start gap-3 rounded-none px-0 text-[16px] font-bold"><Dumbbell className="text-[var(--new-purple)]"/><span className="flex-1 text-left">Add a workout</span><ChevronRight className="text-[var(--new-chevron)]"/></Button></div>}
    <NewSheet open={pick} onOpenChange={setPick} title="Add a workout" hideTitle>
      <SheetActions title="Add a workout" cancel={()=>setPick(false)}/>
      <label className="flex h-11 items-center gap-2 rounded-[12px] bg-[var(--new-control)] px-3"><Search size={18} className="text-[var(--new-muted)]"/><input aria-label="Search workouts" placeholder="Search workouts" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"/></label>
      <div className="my-3 flex gap-2">{(['session','saved'] as const).map(s=><NewSheetChip key={s} selected={source===s} onClick={()=>setSource(s)} className={source===s ? '!border-[var(--new-ink)] !bg-[var(--new-ink)] !text-[var(--new-white)]' : ''}>{s==='session'?'Your log':'Saved'}</NewSheetChip>)}</div>
      {rows.filter(w=>w.title.toLowerCase().includes(query.toLowerCase())).map(w=><NewSheetRow key={w.id} title={w.title} subtitle={`${w.dateLabel ? `${w.dateLabel} · ` : ''}${w.minutes ? `${w.minutes} min · ` : ''}${w.exercises} exercises`} leading={<ExerciseThumb name={w.title} image={w.imageStart} primary={[]} size={44} radius={10}/>} onClick={()=>{onChange({source,id:w.id});setPick(false);}}/>)}
      {!rows.length && <p className="py-4 text-[14px] text-[var(--new-muted)]">No workouts yet.</p>}
    </NewSheet>
    <NewSheet open={edit} onOpenChange={setEdit} title="Edit exercises" hideTitle>
      <SheetActions title="Edit exercises" cancel={()=>setEdit(false)} done={()=>{onChange(moves.length ? {source:'caption',moves} : null);setEdit(false);}}/>
      {moves.map((m,i)=><div key={`${m.exerciseId}-${i}`} className="border-b border-[var(--new-divider)] py-3">
        <div className="flex items-center gap-3"><ExerciseThumb name={m.name} image={m.imageStart} primary={[]} size={44} radius={10}/><strong className="min-w-0 flex-1 text-[15px]">{m.name}</strong><Button variant="ghost" aria-label={`Remove ${m.name}`} onClick={()=>setMoves(ms=>ms.filter((_,j)=>i!==j))} className="h-9 w-9 px-0"><X/></Button></div>
        <div className="mt-2 flex gap-4">{(['sets','reps'] as const).map(key=><div key={key} className="flex flex-1 items-center justify-between gap-1 text-[13px]"><span className="font-semibold">{key==='sets'?'Sets':'Reps'}</span><Button variant="ghost" disabled={m[key]<=1} aria-label={`Fewer ${key} for ${m.name}`} onClick={()=>update(i,key,m[key]-1)} className="h-8 w-8 rounded-full bg-[var(--new-control)] p-0"><Minus/></Button><span className="w-5 text-center font-bold">{m[key]}</span><Button variant="ghost" disabled={m[key]>=(key==='sets'?20:200)} aria-label={`More ${key} for ${m.name}`} onClick={()=>update(i,key,m[key]+1)} className="h-8 w-8 rounded-full bg-[var(--new-control)] p-0"><Plus/></Button></div>)}</div>
      </div>)}
      <Button variant="ghost" disabled={moves.length>=20} onClick={()=>{setEdit(false);setAdd(true);}} className="mt-3 h-11 w-full rounded-[12px] border border-dashed border-[var(--new-chevron)] text-[14px] font-bold"><Plus/>Add exercise</Button>
      <p className="pt-3 text-center text-[13px] text-[var(--new-muted)]">Only sets and reps are shared.</p>
    </NewSheet>
    <NewSheet open={add} onOpenChange={value=>{setAdd(value);if(!value)setEdit(true);}} title="Add exercise">
      <input aria-label="Search exercises" placeholder="Search exercises" value={exerciseQuery} onChange={e=>setExerciseQuery(e.target.value)} className="h-11 w-full rounded-[12px] bg-[var(--new-control)] px-3 text-[15px] outline-none"/>
      {(exercises.data??[]).filter(e=>!moves.some(m=>m.exerciseId===e.exerciseId)).map(e=><NewSheetRow key={e.exerciseId} title={e.name} leading={<ExerciseThumb name={e.name} image={e.imageStart} primary={[]} size={44} radius={10}/>} onClick={()=>{setMoves(ms=>[...ms,e]);setAdd(false);setEdit(true);}}/>)}
    </NewSheet>
  </section>;
}
