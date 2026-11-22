/**
 * Crew page "Today" tab: what each member's row says and the
 * "{n} of {m} completed today" numbers. A member whose own today is covered
 * by a rest or freeze row is resting: not checked in, not nudgeable, not due.
 */
import type { MemberTodayStatus } from "@/lib/group-today.functions";

export type CrewPageStatus = MemberTodayStatus | "rest";

type MemberLike = { status: MemberTodayStatus; resting: boolean; workoutSessionId: string | null };

/** Checked in beats a live workout, which beats a rest/freeze row (same order as Home). */
export function crewPageStatus(m: MemberLike): CrewPageStatus {
  if (!m.resting) return m.status;
  return m.workoutSessionId ? "working_out" : "rest";
}

/** Done = checked in today; due = everyone not resting today. */
export function crewPageCounts(members: MemberLike[]): { done: number; due: number } {
  const statuses = members.map(crewPageStatus);
  return {
    done: statuses.filter((s) => s === "done").length,
    due: statuses.filter((s) => s !== "rest").length,
  };
}

/** Only members still due today (not you, not checked in, not resting) can be nudged. */
export function crewPageCanNudge(status: CrewPageStatus, isYou: boolean): boolean {
  return !isYou && (status === "not_committed" || status === "committed" || status === "in_progress");
}
