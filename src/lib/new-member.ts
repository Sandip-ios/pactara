/** How long after creating their account someone counts as a new member. */
export const NEW_MEMBER_DAYS = 21;

/**
 * New-member rule for the "How Pactara works" header pill and tooltip: the
 * account (profiles.created_at) was created within the last 21 days. Joining
 * or starting a group later never makes someone "new" again.
 */
export function isNewMember(accountCreatedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!accountCreatedAt) return false;
  const created = new Date(accountCreatedAt).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created < NEW_MEMBER_DAYS * 24 * 60 * 60 * 1000;
}
