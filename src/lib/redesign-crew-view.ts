import type { CrewDayState } from "@/lib/crew-today";

export type RedesignWeekCell = "checked" | "rest" | "freeze" | "today" | "empty";

/** Status copy for the new crew Today card; resting members are not due. */
export function crewShowedUpLine(done: number, due: number, viewerDone: boolean): string {
  const left = Math.max(0, due - done);
  if (due > 0 && left === 0) return "Everyone's in. Crew streak safe.";
  if (viewerDone) return `${left} still to go. Everyone needs to be in to keep the crew streak.`;
  return `${left} still to go, including you. Everyone needs to be in to keep the crew streak.`;
}

/** The week grid keeps rest days and manually applied freezes visually distinct. */
export function redesignWeekCell(input: {
  date: string;
  state: CrewDayState;
  today: string;
  coverKind?: "rest" | "freeze";
}): RedesignWeekCell {
  if (input.state === "checked") return "checked";
  if (input.state === "rest") return input.coverKind === "freeze" ? "freeze" : "rest";
  if (input.date === input.today) return "today";
  return "empty";
}

/** "9:05 pm" from the existing HH:MM notification preference. */
export function reminderClock(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const suffix = hour >= 12 ? "pm" : "am";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Workout title first, then the member's current streak. */
export function checkedInSubline(workoutName: string | null | undefined, streak: number): string {
  const streakLine = `${streak}-day streak`;
  return workoutName?.trim() ? `${workoutName.trim()} · ${streakLine}` : streakLine;
}
