/** One check-in's social rows. Legacy NULL rows belong only to the day's first check-in. */
export type ScopedReaction = { checkInId: string | null; userId: string };
export type ScopedComment = { checkInId: string | null };

export function checkInSocialFor<R extends ScopedReaction, C extends ScopedComment>(
  checkInId: string,
  firstCheckInId: string | null,
  reactions: readonly R[],
  comments: readonly C[],
): { reactors: R[]; commentCount: number } {
  const belongs = (row: { checkInId: string | null }) =>
    row.checkInId === checkInId || (row.checkInId === null && firstCheckInId === checkInId);
  const seen = new Set<string>();
  const reactors = reactions.filter((row) => {
    if (!belongs(row) || seen.has(row.userId)) return false;
    seen.add(row.userId);
    return true;
  });
  return { reactors, commentCount: comments.filter(belongs).length };
}
