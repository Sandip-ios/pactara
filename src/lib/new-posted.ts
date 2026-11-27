export type PostedCrew = { id: string };

/** The first selected crew where this check-in counted, or the first selected crew. */
export function postedCrew<T extends PostedCrew>(groups: T[], countedByGroup: Record<string, boolean>): T | null {
  return groups.find((group) => countedByGroup[group.id] === true) ?? groups[0] ?? null;
}

export function postedCrewChip(selectedCrewCount: number): string | null {
  const extra = Math.max(0, selectedCrewCount - 1);
  if (!extra) return null;
  return `+${extra} ${extra === 1 ? "crew" : "crews"}`;
}

export function postedStreak(streak: number, counted: boolean): { counted: true; day: number } | { counted: false; text: string } {
  return counted
    ? { counted: true, day: streak }
    : { counted: false, text: `Already in today · ${streak}-day streak` };
}

export function highestPostedBadge(badges: number[]): number | null {
  return badges.length ? Math.max(...badges) : null;
}

export function postedMediaHeight(hasBadge: boolean): number {
  return hasBadge ? 380 : 430;
}
