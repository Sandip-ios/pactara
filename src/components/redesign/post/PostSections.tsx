import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PostWorkout } from '@/lib/social-post-types';
import { mealMacroLine, postExerciseDose, postSectionCanSave, postWorkoutDetail, sectionPreview, type PostMeal } from '@/lib/post-sections';
import { ExerciseThumb } from '@/components/workout/WorkoutBits';
import { RedesignWorkoutSheet, type SheetAuthor } from '../RedesignCheckInSheets';
import { NewSheet } from '../NewSheet';
import { PostAttachmentSave } from './PostAttachmentSave';
export function PostWorkoutCard({workout,isMine,author,postId}:{workout:PostWorkout;isMine:boolean;author:SheetAuthor|null;postId:string}) {
  const [open,setOpen] = useState(false);
  const preview = sectionPreview(workout.moves);
  const line = `${workout.moves.length} exercises · ${workout.sets} sets${workout.minutes > 0 ? ` · ${workout.minutes} min` : ''}`;
  const action = postSectionCanSave(isMine) ? <PostAttachmentSave postId={postId} kind="workout"/> : null;
  return <>
    <section className="new-post-section workout" aria-label="Workout" onClick={() => setOpen(true)}>
      <Button variant="ghost" className="new-post-section-heading" onClick={() => setOpen(true)}><span className="new-post-section-label">WORKOUT</span><span className="new-post-section-title">{workout.title}</span><span className="new-post-section-meta">{line}</span></Button>
      <ul>{preview.rows.map((m,i) => <li key={`${m.exerciseId}-${i}`}><Button variant="ghost" className="new-post-exercise-row" onClick={() => setOpen(true)}><ExerciseThumb name={m.name} primary={[]} image={m.imageStart} size={28} radius={7}/><span className="min-w-0 flex-1 truncate text-left">{m.name}</span><strong className="shrink-0">{postExerciseDose(m)}</strong></Button></li>)}</ul>
      {preview.more && <Button variant="ghost" className="new-post-section-more" onClick={() => setOpen(true)}>See all {preview.total} exercises</Button>}
      {action}
    </section>
    <RedesignWorkoutSheet open={open} onOpenChange={setOpen} checkInId={`post-${postId}`} card={{kind:'workout',label:'WORKOUT',title:workout.title,line,pr:false}} author={author} isMine={isMine} planSlug={null} detail={postWorkoutDetail(workout,isMine)} attachmentAction={action}/>
  </>;
}
export function PostMealCard({meal,isMine,postId}:{meal:PostMeal;isMine:boolean;postId:string}) {
  const [open,setOpen] = useState(false);
  const preview = sectionPreview(meal.items);
  const action = postSectionCanSave(isMine) ? <PostAttachmentSave postId={postId} kind="meal"/> : null;
  const rows = (items:PostMeal['items']) => <ul>{items.map((item,i) => <li key={i}><Button variant="ghost" className="new-post-meal-row" onClick={() => setOpen(true)}><span className="min-w-0 flex-1 text-left">{item.name}</span><span className="shrink-0 font-semibold text-[var(--new-muted)]">{item.amount}</span></Button></li>)}</ul>;
  return <>
    <section className="new-post-section meal" aria-label="Meal" onClick={() => setOpen(true)}>
      <Button variant="ghost" className="new-post-section-heading" onClick={() => setOpen(true)}><span className="new-post-section-label">MEAL</span><span className="new-post-section-title">{meal.title}</span></Button>
      {rows(preview.rows)}
      {mealMacroLine(meal) && <p className="new-post-meal-macros">{mealMacroLine(meal)}</p>}
      {preview.more && <Button variant="ghost" className="new-post-section-more" onClick={() => setOpen(true)}>See all {preview.total} items</Button>}
      {action}
    </section>
    <NewSheet open={open} onOpenChange={setOpen} title={meal.title} description="Meal details"><div className="new-post-section meal !mx-0 !mt-0 !w-full">{rows(meal.items)}<p className="new-post-meal-macros">{mealMacroLine(meal)}</p>{action}</div></NewSheet>
  </>;
}
