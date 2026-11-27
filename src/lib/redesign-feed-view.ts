/** Pure wording for the redesign's crew Posts tab. */
import type { DayStat } from "@/lib/feed-view";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "TODAY", "YESTERDAY", then "MON, NOV 23". */
export function redesignDayLabel(date: string, viewerToday: string): string {
  if (date >= viewerToday) return "TODAY";
  if (date === shiftDate(viewerToday, -1)) return "YESTERDAY";
  const d = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** A past day kept the crew streak when someone was due, nobody missed and someone checked in. */
export function crewStreakKept(stat: DayStat | null | undefined): boolean {
  return !!stat && stat.due > 0 && stat.missed.length === 0 && stat.checkedIn.length > 0;
}

/** "Chris cheered", "Maya and you cheered", "Maya, Chris +2 cheered"; null with no cheers. */
export function cheeredByLine(reactors: { firstName: string; isMe: boolean }[]): string | null {
  if (reactors.length === 0) return null;
  const names = [...reactors.filter((r) => !r.isMe).map((r) => r.firstName), ...reactors.filter((r) => r.isMe).map(() => "you")];
  if (names.length === 1) return `${names[0] === "you" ? "You" : names[0]} cheered`;
  if (names.length === 2) return `${names[0]} and ${names[1]} cheered`;
  return `${names[0]}, ${names[1]} +${names.length - 2} cheered`;
}

/** "6:12 am · Back day", or just the time. */
export function postMetaLine(time: string, activity: string | null | undefined): string {
  return activity ? `${time} · ${activity}` : time;
}

/* ---------------- Phase 5.1d: one card per check-in ---------------- */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6:12 am · Workout" today, "Yesterday · Run", "Nov 23 · Run" older; tag left out when there is none. */
export function checkInCardMeta(input: { time: string; localDate: string; viewerToday: string; tag: string | null }): string {
  const when = input.localDate >= input.viewerToday
    ? input.time
    : input.localDate === shiftDate(input.viewerToday, -1)
      ? "Yesterday"
      : (() => {
          const d = new Date(`${input.localDate}T12:00:00Z`);
          return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
        })();
  return input.tag ? `${when} · ${input.tag}` : when;
}

export type CardHealth = { type: string; duration: number; distance: number | null; calories: number | null };
export type CardWorkout = { title: string | null; exercises: number; sets: number; minutes: number; prCount: number };
export type CardPlan = { name: string; slug: string; week: number; day: number; dayName?: string | null };
type CardNode = { workout?: CardWorkout | null; plan?: CardPlan | null; health?: CardHealth | null; activity?: string | null };

/** The meta-line tag: "Workout" for logged/plan workouts, the Health name, or the old activity label. */
export function checkInTag(node: CardNode, healthName: (type: string) => string, activityLabel: (a: string | null | undefined) => string | null): string | null {
  if (node.workout || node.plan) return "Workout";
  if (node.health) return healthName(node.health.type);
  const label = activityLabel(node.activity);
  return label ? label.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "") : null;
}

/** "Checked in" pill shows on every check-in (camera-roll posts later will not be check-ins). */
export function showCheckedInPill(kind: "check_in" | "post"): boolean {
  return kind === "check_in";
}

const distanceIn = (meters: number, unit: "mi" | "km") => meters / (unit === "mi" ? 1609.344 : 1000);

/** "28:40", or "1:02:10" past an hour. */
export function clockDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Pace per mile/km, "9:15 /mi"; null without a distance. */
export function healthPace(w: CardHealth, unit: "mi" | "km"): string | null {
  if (!w.distance || w.distance <= 0 || w.duration <= 0) return null;
  const per = w.duration / distanceIn(w.distance, unit);
  return `${clockDuration(per)} /${unit}`;
}

/** Card line: with a distance "3.1 mi · 28:40 · 9:15 /mi"; otherwise "45 min · 312 cal". */
export function healthCardLine(w: CardHealth, unit: "mi" | "km"): string {
  if (w.distance && w.distance > 0) {
    return [`${distanceIn(w.distance, unit).toFixed(1)} ${unit}`, clockDuration(w.duration), healthPace(w, unit)].filter(Boolean).join(" · ");
  }
  return [`${Math.round(w.duration / 60)} min`, w.calories !== null ? `${Math.round(w.calories)} cal` : null].filter(Boolean).join(" · ");
}

/** Sheet tiles, only for stats Health gave us (heart rate and elevation never leave the phone). */
export function healthTiles(w: CardHealth, unit: "mi" | "km"): { label: string; value: string }[] {
  const tiles: { label: string; value: string }[] = [];
  if (w.distance && w.distance > 0) tiles.push({ label: "Distance", value: `${distanceIn(w.distance, unit).toFixed(1)} ${unit}` });
  tiles.push({ label: "Time", value: clockDuration(w.duration) });
  const pace = healthPace(w, unit);
  if (pace) tiles.push({ label: "Pace", value: pace });
  if (w.calories !== null) tiles.push({ label: "Calories", value: `${Math.round(w.calories)}` });
  return tiles;
}

export type AttachedCard =
  | { kind: "workout" | "plan"; label: string; title: string; line: string; pr: boolean }
  | { kind: "health"; label: string; title: string; line: string; pr: false };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const workoutCardLine = (w: CardWorkout) => `${plural(w.exercises, "exercise")} · ${plural(w.sets, "set")} · ${w.minutes} min`;

/** What the attached card under a check-in shows. Plan beats a plain workout; no weights anywhere. */
export function attachedCard(node: CardNode, unit: "mi" | "km", healthName: (type: string) => string): AttachedCard | null {
  if (node.plan) {
    return {
      kind: "plan",
      label: `PLAN · WEEK ${node.plan.week}, DAY ${node.plan.day}`,
      title: node.plan.dayName ? `${node.plan.name}: ${node.plan.dayName}` : node.plan.name,
      line: node.workout ? workoutCardLine(node.workout) : "",
      pr: (node.workout?.prCount ?? 0) > 0,
    };
  }
  if (node.workout) {
    return { kind: "workout", label: "WORKOUT", title: node.workout.title || "Workout", line: workoutCardLine(node.workout), pr: node.workout.prCount > 0 };
  }
  if (node.health) {
    return { kind: "health", label: "APPLE HEALTH", title: healthName(node.health.type), line: healthCardLine(node.health, unit), pr: false };
  }
  return null;
}

/** PR chips: always on check-ins (anyone's); on posts only your own. */
export function showPrChip(source: "check_in" | "post", isMine: boolean): boolean {
  return source === "check_in" || isMine;
}

type SheetSet = { reps: number | null; seconds: number | null; weight?: number | null };

/** "3 sets · 10, 8, 8 reps" or "3 sets · 0:45, 0:45, 0:30". Never a weight. */
export function sheetSetLine(sets: SheetSet[], logType: "reps" | "timed"): string {
  const head = plural(sets.length, "set");
  if (!sets.length) return head;
  if (logType === "timed") return `${head} · ${sets.map((s) => clockDuration(s.seconds ?? 0)).join(", ")}`;
  return `${head} · ${sets.map((s) => s.reps ?? 0).join(", ")} reps`;
}

/** The weights note shows only when the crewmate's workout has a weighted exercise. */
export function hasWeightedExercise(exercises: { sets: SheetSet[] }[]): boolean {
  return exercises.some((e) => e.sets.some((s) => (s.weight ?? 0) > 0));
}

/** "From Apple Health on Maya's iPhone." / "From Apple Health on your iPhone." */
export function healthSourceNote(firstName: string, isMine: boolean): string {
  return `From Apple Health on ${isMine ? "your" : `${firstName}'s`} iPhone.`;
}
