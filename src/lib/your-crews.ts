/**
 * Your crews sheet rules (pure): the "still to show up" count, each crew's
 * "in today" line and reading a pasted invite.
 */
import { crewWaiting } from "@/lib/group-today-view";

type Member = Parameters<typeof crewWaiting>[0][number] & { userId: string };

/** People (counted once, even across crews) who still owe a check-in today; resting members don't count. */
export function crewsStillToShowUp(groups: readonly { members: Member[] }[]): number {
  return new Set(groups.flatMap((g) => crewWaiting(g.members).map((m) => m.userId))).size;
}

/** "0 of 4 in today" (members resting today aren't counted as due). */
export const inTodayLine = (c: { done: number; due: number }) => `${c.done} of ${c.due} in today`;

/** An invite link ("…/join/<id>") or a bare code, or null when there's nothing usable. */
export function inviteIdFromInput(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const fromLink = text.match(/\/join\/([^/?#\s]+)/i)?.[1];
  const id = (fromLink ?? text).trim();
  return /^[A-Za-z0-9-]{4,64}$/.test(id) ? id : null;
}
