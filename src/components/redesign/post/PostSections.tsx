import { AttachmentMealCard } from "../MealViews";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PostWorkout } from "@/lib/social-post-types";
import {
  mealMacroLine,
  postExerciseDose,
  postSectionCanSave,
  postWorkoutDetail,
  postWorkoutSummary,
  sectionPreview,
  type PostMeal,
} from "@/lib/post-sections";
import { ExerciseThumb } from "@/components/workout/WorkoutBits";
import { RedesignWorkoutSheet, type SheetAuthor } from "../RedesignCheckInSheets";
import { NewSheet } from "../NewSheet";
import { PostAttachmentSave } from "./PostAttachmentSave";
import type { AttachedCard } from "@/lib/redesign-feed-view";
import type { WorkoutDetail } from "@/lib/lifts.functions";
export function PostWorkoutCard({
  workout,
  isMine,
  author,
  postId,
  checkIn,
}: {
  workout: PostWorkout;
  isMine: boolean;
  author: SheetAuthor | null;
  postId: string;
  checkIn?: { card: AttachedCard; planSlug: string | null; detail: WorkoutDetail };
}) {
  const [open, setOpen] = useState(false);
  const preview = sectionPreview(workout.moves);
  const line = checkIn?.card.line || postWorkoutSummary(workout);
  const action = postSectionCanSave(isMine) ? (
    <PostAttachmentSave postId={postId} kind="workout" checkIn={!!checkIn} />
  ) : null;
  return (
    <>
      <section
        className="new-post-section workout"
        aria-label="Workout"
        onClick={() => setOpen(true)}
      >
        <Button variant="ghost" className="new-post-section-heading" onClick={() => setOpen(true)}>
          <span className="new-post-section-label">WORKOUT</span>
          {checkIn?.card.kind === "plan" && <span className="new-post-section-meta">{checkIn.card.label} · {checkIn.card.title}</span>}
          <span className="new-post-section-title">{workout.title}</span>
          <span className="new-post-section-meta">{line}</span>
        </Button>
        <ul>
          {preview.rows.map((m, i) => (
            <li key={`${m.exerciseId}-${i}`}>
              <Button
                variant="ghost"
                className="new-post-exercise-row"
                onClick={() => setOpen(true)}
              >
                <ExerciseThumb
                  name={m.name}
                  primary={[]}
                  image={m.imageStart}
                  size={28}
                  radius={7}
                />
                <span className="min-w-0 flex-1 truncate text-left">{m.name}</span>
                <strong className="shrink-0">{postExerciseDose(m)}</strong>
              </Button>
            </li>
          ))}
        </ul>
        {preview.more && (
          <Button variant="ghost" className="new-post-section-more" onClick={() => setOpen(true)}>
            See all {preview.total} exercises
          </Button>
        )}
        {action}
        {checkIn?.card.pr && <span className="mt-1.5 inline-flex h-[22px] items-center rounded-full bg-[var(--new-warning-soft)] px-2 text-[11px] font-extrabold text-[var(--new-warning-ink)]">🏆 New PR</span>}
      </section>
      <RedesignWorkoutSheet
        open={open}
        onOpenChange={setOpen}
        checkInId={checkIn ? postId : `post-${postId}`}
        card={checkIn?.card ?? { kind: "workout", label: "WORKOUT", title: workout.title, line, pr: false }}
        author={author}
        isMine={isMine}
        planSlug={checkIn?.planSlug ?? null}
        detail={checkIn?.detail ?? postWorkoutDetail(workout, isMine)}
        attachmentAction={action}
      />
    </>
  );
}
export function PostMealCard({ meal, isMine, postId }: { meal: PostMeal; isMine: boolean; postId: string }) {
  return <AttachmentMealCard id={postId} kind="post" isMine={isMine} />;
}
