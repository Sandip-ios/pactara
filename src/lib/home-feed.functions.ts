import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { homePage, type HomeEntry, type HomeRef } from './home-feed';
import { signAvatarThumbs, signFeedMedia, signVideoPosters } from './media-urls';
import { stabilizeSignedUrls } from './stable-urls';
import type { FeedItem } from './daily-posts.functions';
import type { CheckInNode } from './feed-days';
type CheckInRow = { id: string; userId: string; groupId: string; localDate: string; createdAt: string; note: string | null; activity: string | null; mood: string | null; photoUrl: string | null; health: unknown; name: string | null; avatarUrl: string | null; avatarColor: string | null; postId: string | null; workout: CheckInNode['workout'] };
const pageInput = z.object({ tab: z.enum(['following','for-you']), before: z.object({ at: z.string().datetime({ offset: true }), key: z.string().max(80) }).nullable().optional() });
export const getNewHomeFeed = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(data => pageInput.parse(data)).handler(async ({ context, data }) => {
  const supabase = context.supabase as unknown as SupabaseClient;
  const { loadSocialPostsForViewer } = await import("./social-post-load.server");
  const { data: rawRefs, error } = await supabase.rpc('get_new_home_refs', { _tab: data.tab, _before: data.before ?? null });
  if (error) throw new Error('Could not load Home');
  const { page, next } = homePage((rawRefs ?? []) as HomeRef[]);
  const postIds = page.filter(r => r.kind === 'post').map(r => r.id);
  const checkInIds = page.filter(r => r.kind === 'checkin').map(r => r.id);
  const [posts, checkResult] = await Promise.all([
    postIds.length ? supabase.from('social_posts').select('*').in('id', postIds).then(({ data: rows }) => loadSocialPostsForViewer(supabase, context.userId, (rows ?? []) as Record<string, unknown>[])) : [],
    checkInIds.length ? supabase.rpc('get_new_home_checkins', { _ids: checkInIds }) : { data: [], error: null },
  ]);
  if (checkResult.error) throw new Error('Could not load Home');
  const rows = (checkResult.data ?? []) as CheckInRow[];
  // Visibility is decided by the RPC above; signing uses the service client because follower-shared media is outside crew storage rules.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const [avatars, media, posters] = await Promise.all([
    signAvatarThumbs(supabaseAdmin, rows.map(r => r.avatarUrl)),
    signFeedMedia(supabaseAdmin, rows.map(r => r.photoUrl)),
    signVideoPosters(supabaseAdmin, rows.map(r => r.photoUrl)),
  ]);
  const postById = new Map(posts.map(p => [p.id, p]));
  const checkById = new Map(rows.map(r => [r.id, r]));
  const refByKey = new Map(page.map(r => [r.key, r]));
  const entries: HomeEntry[] = page.flatMap((ref): HomeEntry[] => {
    if (ref.kind === 'post') { const post = postById.get(ref.id); return post ? [{ kind: 'post', key: ref.key, post }] : []; }
    const c = checkById.get(ref.id); if (!c) return [];
    const checkIn: CheckInNode = { kind: 'check_in', id: `c-${c.id}`, mood: c.mood, activity: c.activity, workout: c.workout, health: c.health as CheckInNode['health'], note: c.note, isCounted: true, social: { reactors: [], commentCount: 0 }, photoUrl: c.photoUrl ? (c.photoUrl.startsWith("http") ? c.photoUrl : media.get(c.photoUrl) ?? null) : null, posterUrl: c.photoUrl ? posters.get(c.photoUrl) ?? null : null, at: c.createdAt };
    const item: FeedItem = { id: c.postId ?? c.id, groupId: c.groupId, userId: c.userId, isMe: c.userId === context.userId, name: c.name || 'Member', avatarColor: c.avatarColor || '#7C3AED', avatarUrl: c.avatarUrl ? (c.avatarUrl.startsWith('http') ? c.avatarUrl : avatars.get(c.avatarUrl) ?? null) : null, localDate: c.localDate, updatedAt: c.createdAt, nodes: [checkIn], reactions: [], reactors: [], commentCount: 0, lastCommentAt: null, latestComment: null, dayNumber: 0, weekCount: 0 };
    const crewName = refByKey.get(ref.key)?.crew_name ?? null;
    return [{ kind: 'checkin', key: ref.key, item, checkIn, crewName, canInteract: !!crewName && !!c.postId }];
  });
  return stabilizeSignedUrls({ entries, next });
});
export const getNewHomeSuggestions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('get_new_home_suggestions');
  if (error) throw new Error('Could not load suggestions');
  const people = (data ?? []) as { id: string; name: string | null; avatar_url: string | null; avatar_color: string | null }[];
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const avatars = await signAvatarThumbs(supabaseAdmin, people.map(p => p.avatar_url));
  return people.map(p => ({ id: p.id, name: p.name?.trim() || 'Member', avatarUrl: p.avatar_url ? (p.avatar_url.startsWith('http') ? p.avatar_url : avatars.get(p.avatar_url) ?? null) : null, avatarColor: p.avatar_color ?? '#7C3AED' }));
});

export const getHomeFollowState = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(data => z.object({target:z.string().uuid()}).parse(data)).handler(async ({context,data}) => {
  const {data:profile,error} = await context.supabase.rpc('get_profile',{target:data.target});
  if(error) throw new Error('Could not load follow state');
  const p = profile as {relationship?:string;can_follow?:boolean}|null;
  return {relationship:p?.relationship ?? 'none',canFollow:p?.can_follow === true};
});
