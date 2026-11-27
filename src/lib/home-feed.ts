import type { FeedItem } from './daily-posts.functions';
import type { CheckInNode } from './feed-days';
import type { SocialPostView } from './social-post-types';
export type HomeTab = 'following' | 'for-you';
export type HomeCursor = { at: string; key: string };
export type HomeRef = { kind: 'post' | 'checkin'; id: string; key: string; created_at: string; group_id: string | null; crew_name: string | null };
export type HomeEntry = { kind: 'post'; key: string; post: SocialPostView } | { kind: 'checkin'; key: string; item: FeedItem; checkIn: CheckInNode; crewName: string | null; canInteract: boolean };
export const HOME_PAGE_SIZE = 20;
export const HOME_INITIAL_TAB: HomeTab = 'for-you';
/** Newest first with a stable tie-breaker; cursors never drop same-time posts. */
export function homePage(refs: HomeRef[]) {
  const rows = [...new Map(refs.map(r => [r.key, r])).values()].sort((a,b) => b.created_at.localeCompare(a.created_at) || b.key.localeCompare(a.key));
  const page = rows.slice(0, HOME_PAGE_SIZE);
  const last = page.at(-1);
  return { page, next: rows.length > HOME_PAGE_SIZE && last ? { at: last.created_at, key: last.key } : null };
}
export function mergeHomeEntries(pages: HomeEntry[][], own: SocialPostView[] = []): HomeEntry[] {
  const seen = new Set<string>();
  return [...own.map(post => ({ kind: 'post' as const, key: `post:${post.id}`, post })), ...pages.flat()].filter(entry => { if (seen.has(entry.key)) return false; seen.add(entry.key); return true; });
}
/** For you only recommends strangers' publicly shared content; Following includes own/crew/shared-follow content. */
export function homeEligible(tab: HomeTab, item: { own: boolean; crew: boolean; peer: boolean; followed: boolean; shared: boolean; public: boolean; blocked: boolean; hidden: boolean }): boolean {
  if (item.blocked || item.hidden) return false;
  return tab === 'following' ? item.own || item.crew || item.followed && item.shared : !item.own && !item.peer && !item.followed && item.shared && item.public;
}
