import type { GroupToday } from "./group-today.functions";
import { crewPageCounts, crewWaiting } from "./group-today-view";
import { BADGE_MILESTONES } from "./badges";

const KEY = "pactara:new-checkin";
export type NewCheckInSession = { groupIds: string[]; returnCrewId: string | null; returnToActivity?: boolean };
export function readNewCheckIn(): NewCheckInSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as NewCheckInSession | null;
    return value && Array.isArray(value.groupIds) ? value : null;
  } catch { return null; }
}
export function writeNewCheckIn(value: NewCheckInSession) {
  try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private mode */ }
}
export function clearNewCheckIn() {
  try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
}
export function beginNewCheckIn(groupId: string, returnCrewId: string | null, returnToActivity = false) {
  try { localStorage.setItem("active-group-id", groupId); } catch { /* private mode */ }
  writeNewCheckIn({ groupIds: [], returnCrewId, returnToActivity });
}
export function eligibleCrewIds(groups: GroupToday[]): string[] {
  return groups.filter((g) => g.members.find((m) => m.isYou)?.status !== "done").map((g) => g.id);
}
export function nextCheckInBadge(streak: number) {
  const milestone = BADGE_MILESTONES.find((n) => n > streak);
  return milestone ? { milestone, remaining: milestone - streak } : null;
}
export function doneCrewLine(groups: GroupToday[]): string {
  if (groups.length > 1) return `You're in for ${groups.map((g) => g.name).join(" and ")}.`;
  const group = groups[0];
  if (!group) return "You're checked in today.";
  const counts = crewPageCounts(group.members);
  const waiting = crewWaiting(group.members).filter((m) => !m.isYou);
  if (counts.done === counts.due) return "Everyone's in. Crew streak safe.";
  if (!waiting.length) return `${group.name} is now ${counts.done} of ${counts.due}.`;
  return `${group.name} is now ${counts.done} of ${counts.due}. ${waiting.map((m) => m.firstName).join(" and ")} ${waiting.length === 1 ? "is" : "are"} still to go.`;
}