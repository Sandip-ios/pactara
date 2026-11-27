/** Who sees a camera-roll post. Pure, so the composer and tests share one rule set. */
export type PostAudience = { everyone: boolean; crewIds: string[] };

/** Everyone and every crew on by default; under-18 accounts get crews only. */
export function defaultAudience(crewIds: string[], under18: boolean): PostAudience {
  return { everyone: !under18, crewIds: [...crewIds] };
}

export function audienceIsValid(a: PostAudience, under18: boolean): boolean {
  if (under18 && a.everyone) return false;
  return a.everyone || a.crewIds.length > 0;
}

/** Toggle "Everyone". Never leaves the post with no audience; under-18 can't turn it on. */
export function toggleEveryone(a: PostAudience, under18: boolean): PostAudience {
  if (under18) return { ...a, everyone: false };
  const next = { ...a, everyone: !a.everyone };
  return audienceIsValid(next, under18) ? next : a;
}

/** Toggle one crew chip. At least one chip always stays on. */
export function toggleCrew(a: PostAudience, crewId: string, under18: boolean): PostAudience {
  const on = a.crewIds.includes(crewId);
  const next = { ...a, crewIds: on ? a.crewIds.filter((id) => id !== crewId) : [...a.crewIds, crewId] };
  return audienceIsValid(next, under18) ? next : a;
}

/** The chips row helper under "Who sees it". */
export function audienceHelper(crewNames: string[], under18: boolean): string {
  const crew = crewNames.length === 1 ? crewNames[0]! : "Your crews";
  const crewLine = `${crew}: shows in the crew, but isn't a check-in.`;
  if (under18) return crewLine;
  return `Everyone: your profile, followers' feeds and Discover (videos over 3 min skip Discover). ${crewLine}`;
}

/** Mirrors can_see_social_post in the database. */
export function canSeePost(
  post: { authorId: string; live: boolean; everyone: boolean; crewIds: string[]; authorPrivate: boolean },
  viewer: { id: string; crewIds: string[]; followsAuthor: boolean; blockedEitherWay: boolean },
): boolean {
  if (viewer.id === post.authorId) return true;
  if (!post.live || viewer.blockedEitherWay) return false;
  if (post.crewIds.some((id) => viewer.crewIds.includes(id))) return true;
  return post.everyone && (!post.authorPrivate || viewer.followsAuthor);
}

/** Only "Everyone" posts can reach followers' feeds and Discover. */
export function reachesFollowers(post: { everyone: boolean }): boolean {
  return post.everyone;
}
