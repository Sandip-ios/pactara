/** New version only: how many crews one person can be in. Shown in copy; classic does not enforce it. */
export const MAX_CREWS_PER_PERSON = 3;

export const atCrewLimit = (crewCount: number) => crewCount >= MAX_CREWS_PER_PERSON;

export const crewLimitLine = () =>
  `You're in ${MAX_CREWS_PER_PERSON} of ${MAX_CREWS_PER_PERSON} crews. Leave one to join or start another.`;

export const crewLimitButton = () => `You're in ${MAX_CREWS_PER_PERSON} crews`;

/** Chat badge wording on crew cards; null hides it. */
export const unreadBadgeLabel = (count: number) => (count > 0 ? `${count} new` : null);
