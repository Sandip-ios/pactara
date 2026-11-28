/** Shapes shared by camera-roll post screens and server functions. Never carries weights. */
export type PostWorkoutSet = { reps: number | null; seconds: number | null; isPr: boolean };
export type PostWorkoutMove = { exerciseId: string; name: string; imageStart: string | null; logType: "reps" | "timed"; sets: PostWorkoutSet[] };
export type PostWorkout = { source: "caption" | "session" | "saved"; title: string; minutes: number; sets: number; prCount: number; moves: PostWorkoutMove[] };

export type PostItemInput = {
  kind: "photo" | "video";
  path: string;
  posterPath: string | null;
  duration: number | null;
  trimStart: number | null;
  trimEnd: number | null;
  muted: boolean;
  cover: number | null;
  crop: { aspect: "4:5" | "3:4" | "original"; y: number } | null;
};

export type PostWorkoutChoice =
  | { source: "caption"; moves: { exerciseId: string; name: string; imageStart: string | null; sets: number; reps: number }[] }
  | { source: "session"; id: string }
  | { source: "saved"; id: string }
  | null;

export type SocialPostItem = {
  id: string; kind: "photo" | "video"; url: string | null; posterUrl: string | null;
  trimStart: number | null; trimEnd: number | null; muted: boolean; crop: { aspect: "4:5" | "3:4" | "original"; y: number } | null;
};

export type SocialPostView = {
  id: string;
  author: { id: string; name: string; avatarUrl: string | null; avatarColor: string };
  isMine: boolean;
  caption: string;
  createdAt: string;
  status: "uploading" | "live" | "failed";
  audience: import("./post-audience").AudienceKind;
  crewIds: string[];
  /** Crews this post went to that the viewer is in (names for the header line). */
  viewerCrews: { id: string; name: string }[];
  commentsOn: boolean;
  items: SocialPostItem[];
  workout: PostWorkout | null;
  meal?: import("./post-sections").PostMeal | null;
  workoutId: string | null;
  workoutSessionId: string | null;
  pinnedAt: string | null;
  cheers: number;
  reactors?: { firstName: string; isMe: boolean }[];
  cheeredByMe: boolean;
  comments: number;
  saves: number;
  savedByMe: boolean;
  /** People tagged in the post the viewer may see (blocked pairs left out). */
  tagged: { id: string; name: string; username: string | null; avatarUrl: string | null; avatarColor: string }[];
};
