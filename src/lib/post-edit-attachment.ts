import type { PostWorkout, PostWorkoutChoice, SocialPostView } from "./social-post-types";
import { postWorkoutSummary } from "./post-sections";

export function editWorkoutChoice(post: Pick<SocialPostView, "workout" | "workoutSessionId" | "workoutId">): PostWorkoutChoice {
  const w = post.workout;
  if (!w) return null;
  if (w.source === "caption") return { source: "caption", moves: w.moves.map(m => ({ exerciseId: m.exerciseId, name: m.name, imageStart: m.imageStart, sets: m.sets.length, reps: m.sets[0]?.reps ?? 10 })) };
  if (w.source === "session" && post.workoutSessionId) return { source: "session", id: post.workoutSessionId };
  if (w.source === "saved" && post.workoutId) return { source: "saved", id: post.workoutId };
  return null;
}

/** A post's immutable snapshot wins over mutable picker/template counts. */
export function attachmentWorkoutView(choice: PostWorkoutChoice, snapshot: PostWorkout | null | undefined) {
  if (!choice) return null;
  if (snapshot) return { title: snapshot.title, line: postWorkoutSummary(snapshot) };
  if (choice.source === "caption") return { title: "From your caption", line: postWorkoutSummary({ moves: choice.moves, sets: choice.moves.reduce((n, m) => n + m.sets, 0), minutes: 0 }) };
  return null;
}