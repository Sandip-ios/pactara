/** Chat badge wording on crew cards, matching the crew switcher; null hides it. */
export const unreadBadgeLabel = (count: number) => (count > 0 ? `${count} new` : null);
