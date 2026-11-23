/**
 * Workout sharing rules (pure, no React, no network): copying a crewmate's
 * logged workout, the share-link snapshot, names and the words on screen.
 * Weights are never part of a copy or a snapshot.
 */
import { DEFAULT_REPS_HI, DEFAULT_REPS_LO, fmtDurationShort, plural, type LogType } from "@/lib/lift-rules";
import { clampSets, draftMeta, estimateMinutes } from "@/lib/workout-builder";
import { missedDayLabel } from "@/lib/streak-rules";
import { feedDayKey } from "@/lib/feed-view";

export const SHARE_ORIGIN = "https://pactara.lovable.app";
export const SHARE_CODE_LENGTH = 8;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const NAME_MAX = 60;

/** One exercise of a saved workout (what `workouts.exercises` holds). */
export type TemplateItem = { exerciseId: string; sets: number; restSeconds?: number; seconds?: number };

/** One exercise of a share-link snapshot. */
export type SnapshotItem = {
  exerciseId: string;
  sets: number;
  /** "8-12" for rep moves (the default rule outside plans), null for timed ones. */
  repsTarget: string | null;
  /** Timed moves: seconds per set, when known. */
  secondsTarget: number | null;
};

/** A share link as anyone may see it: no weights, history or crew info. */
export type PublicSharedWorkout = {
  code: string;
  name: string;
  ownerFirstName: string;
  ownerAvatarUrl: string | null;
  ownerAvatarColor: string;
  exercises: (SnapshotItem & {
    name: string;
    imageStart: string | null;
    primary: string[];
    equipment: string;
    logType: LogType;
  })[];
};

export const isShareCode = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9]{8}$/.test(s);

/** A short random code (8 letters/digits, no look-alikes). */
export function makeShareCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(SHARE_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) out += CODE_ALPHABET[(bytes[i] ?? 0) % CODE_ALPHABET.length];
  return out;
}

export const shareUrl = (code: string) => `${SHARE_ORIGIN}/w/${code}`;
export const shareTitle = (name: string) => `${name} · Pactara`;
export const shareText = (name: string) => `Try my ${name} on Pactara`;

export const firstNameOf = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "Someone";

/**
 * The name the copy gets: the workout's own title (or "Workout"), with
 * " (2)", " (3)"… when the member already has one by that name.
 */
export function uniqueWorkoutName(base: string | null | undefined, existing: readonly string[]): string {
  const name = (base ?? "").trim().slice(0, NAME_MAX) || "Workout";
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; i < 1000; i++) {
    const suffix = ` (${i})`;
    const candidate = `${name.slice(0, NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return name;
}

/**
 * A crewmate's logged workout as a saved workout: same exercises in the
 * same order, as many sets as they logged, reps left to the default 8–12
 * rule, timed moves keep their logged time as the target. No weights.
 */
export function itemsFromLoggedWorkout(
  exercises: readonly { exerciseId: string; logType: LogType; sets: readonly { seconds: number | null }[] }[],
): TemplateItem[] {
  return exercises
    .filter((e) => e.sets.length > 0)
    .map((e) => {
      const item: TemplateItem = { exerciseId: e.exerciseId, sets: clampSets(e.sets.length) };
      if (e.logType === "timed") {
        const longest = Math.max(0, ...e.sets.map((s) => s.seconds ?? 0));
        if (longest > 0) item.seconds = longest;
      }
      return item;
    });
}

/** The share-link snapshot of a saved workout. */
export function snapshotOf(items: readonly TemplateItem[], logTypeOf: (exerciseId: string) => LogType): SnapshotItem[] {
  return items.map((it) => {
    const timed = logTypeOf(it.exerciseId) === "timed";
    return {
      exerciseId: it.exerciseId,
      sets: clampSets(it.sets),
      repsTarget: timed ? null : `${DEFAULT_REPS_LO}-${DEFAULT_REPS_HI}`,
      secondsTarget: timed && it.seconds ? it.seconds : null,
    };
  });
}

/** Same name and same exercises → the same link is reused. */
export function snapshotKey(name: string, items: readonly SnapshotItem[]): string {
  return JSON.stringify([name.trim(), items.map((i) => [i.exerciseId, i.sets, i.repsTarget, i.secondsTarget])]);
}

/** A snapshot saved into someone's My workouts. */
export function itemsFromSnapshot(items: readonly SnapshotItem[]): TemplateItem[] {
  return items.map((i) => {
    const out: TemplateItem = { exerciseId: i.exerciseId, sets: clampSets(i.sets) };
    if (i.secondsTarget) out.seconds = i.secondsTarget;
    return out;
  });
}

/** "3 sets · 8–12 reps" / "3 sets · 30 sec" / "2 sets". */
export function targetLine(i: Pick<SnapshotItem, "sets" | "repsTarget" | "secondsTarget">): string {
  const sets = plural(i.sets, "set");
  if (i.repsTarget) return `${sets} · ${i.repsTarget.replace("-", "–")} reps`;
  if (i.secondsTarget) return `${sets} · ${fmtDurationShort(i.secondsTarget)}`;
  return sets;
}

/** "4 exercises · 10 sets · about 40 min" */
export const sharedMeta = (items: readonly Pick<SnapshotItem, "sets">[]) => draftMeta([...items]);

/** Link preview text: "Ana shared a workout: 4 exercises · about 40 min". */
export function shareDescription(firstName: string, items: readonly Pick<SnapshotItem, "sets">[]): string {
  const sets = items.reduce((a, i) => a + i.sets, 0);
  return `${firstName} shared a workout: ${plural(items.length, "exercise")} · about ${estimateMinutes(sets)} min`;
}

/** The feed sheet's "Ana · Yesterday": the post's day from the viewer's today. */
export function postDayLabel(postDate: string, viewerToday: string): string {
  return missedDayLabel(feedDayKey(postDate, viewerToday), viewerToday);
}

// ---- Sharing into a crew's chat ----

/** A crew in a Share panel (workouts and plans). */
export type ShareCrew = {
  id: string;
  name: string;
  emoji: string;
  memberCount: number;
  others: { id: string; name: string; avatarColor: string; avatarUrl: string | null }[];
};

/** Above the chat card: "Ana shared a workout" ("You shared a workout" on your own). */
export const chatShareLabel = (firstName: string, mine: boolean) => `${mine ? "You" : firstName} shared a workout`;

/** Push and notification text: "Ana shared a workout: Push day". */
export const chatSharePushText = (firstName: string, name: string) => `${firstName} shared a workout: ${name}`;

/**
 * The crews in the share panel: most recent chat message first; crews with
 * no messages yet follow, newest joined first. Crews with nobody else in
 * them (a solo pact while searching for a partner) are left out.
 */
export function orderCrewsForShare<T extends { id: string; othersCount: number; lastMessageAt: string | null; joinedAt: string }>(
  crews: readonly T[],
): T[] {
  return crews
    .filter((c) => c.othersCount > 0)
    .slice()
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return b.joinedAt.localeCompare(a.joinedAt);
    });
}

/** Crews that already got this exact snapshot from you (a changed workout has a new code, so none). */
export function crewsAlreadySent(messages: readonly { groupId: string; code: string | null }[], code: string | null): string[] {
  if (!code) return [];
  return [...new Set(messages.filter((m) => m.code === code).map((m) => m.groupId))];
}
