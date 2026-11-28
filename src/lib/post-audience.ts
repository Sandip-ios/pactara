/** One audience per library post. Private status limits Everyone at read time. */
export type AudienceKind = 'everyone' | 'crews' | 'only_me';
export type PostAudience = { kind: AudienceKind; crewIds: string[] };
export type AudienceContext = { crews: { id: string; name?: string; members?: number }[]; under18: boolean; isPrivate: boolean; remembered?: PostAudience | null };
export function audienceOptions(ctx: AudienceContext): AudienceKind[] {
  return [...(!ctx.under18 ? ['everyone' as const] : []), ...(ctx.crews.length ? ['crews' as const] : []), 'only_me'];
}
export function selectAudience(kind: AudienceKind, ctx: AudienceContext, crewIds?: string[]): PostAudience {
  const all = ctx.crews.map(c => c.id);
  return { kind, crewIds: kind === 'only_me' ? [] : kind === 'everyone' ? all : (crewIds ?? all).filter(id => all.includes(id)) };
}
export function defaultAudience(ctx: AudienceContext): PostAudience {
  const options = audienceOptions(ctx);
  const last = ctx.remembered;
  let kind = last?.kind ?? options[0] ?? 'only_me';
  if (!options.includes(kind)) kind = kind === 'everyone' && options.includes('crews') ? 'crews' : 'only_me';
  const value = selectAudience(kind, ctx, last?.kind === 'crews' ? last.crewIds : undefined);
  // A remembered crew selection whose last crew was left falls down to Only me.
  return value.kind === 'crews' && !value.crewIds.length ? selectAudience('only_me', ctx) : value;
}
export function audienceIsValid(a: PostAudience, under18: boolean): boolean {
  return ['everyone', 'crews', 'only_me'].includes(a.kind) && !(under18 && a.kind === 'everyone') && (a.kind !== 'crews' || a.crewIds.length > 0) && (a.kind !== 'only_me' || a.crewIds.length === 0);
}
export function audienceLabel(a: PostAudience, isPrivate: boolean): string {
  return a.kind === 'everyone' ? isPrivate ? 'Followers' : 'Everyone' : a.kind === 'crews' ? 'Crews' : 'Only me';
}
export function canSeePost(
  post: { authorId: string; live: boolean; kind: AudienceKind; crewIds: string[]; authorPrivate: boolean },
  viewer: { id: string; crewIds: string[]; followsAuthor: boolean; blockedEitherWay: boolean },
): boolean {
  if (viewer.id === post.authorId) return true;
  if (!post.live || post.kind === 'only_me' || viewer.blockedEitherWay) return false;
  return post.crewIds.some(id => viewer.crewIds.includes(id)) || (post.kind === 'everyone' && (!post.authorPrivate || viewer.followsAuthor));
}
/** Only shared posts expose comment controls, previews, counts or threads. Cheers are independent. */
export function postCommentsVisible(post: { audience: AudienceKind; commentsOn: boolean }): boolean {
  return post.audience !== 'only_me' && post.commentsOn;
}
export function reachesFollowers(post: { kind: AudienceKind }): boolean { return post.kind === 'everyone'; }
export function reachesDiscover(post: { kind: AudienceKind; authorPrivate: boolean; skipDiscover: boolean }): boolean {
  return post.kind === 'everyone' && !post.authorPrivate && !post.skipDiscover;
}
