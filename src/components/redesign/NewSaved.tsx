import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Bookmark, Check, ChevronLeft, Layers, Pin, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSavedPosts } from '@/lib/saved.functions';
import type { SavedTile } from '@/lib/saved-posts';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { dismissToastNow } from './new-toast';
import { SAVED_TOAST_ID } from './use-feed-save';

export const savedPostsKey = ['saved-posts'] as const;

/** Dark pill on a grid tile (WORKOUT, ✓ CHECK-IN). */
function TilePill({ children }: { children: React.ReactNode }) {
  return <span className="absolute bottom-1.5 left-1.5 flex h-5 items-center gap-0.5 rounded-full bg-[rgba(20,18,24,0.72)] px-1.5 text-[10px] font-extrabold tracking-[0.04em] text-white">{children}</span>;
}

/** One 4:5 tile shared by Saved and the profile Posts grid: video, multi-photo, WORKOUT, check-in and (profile only) pin markers. */
export function PostGridTile({ tile }: { tile: SavedTile }) {
  const router = useRouter();
  return <a href={tile.href} onClick={e => { e.preventDefault(); router.history.push(tile.href); }} aria-label={tile.label} className="relative block aspect-[4/5] overflow-hidden bg-[var(--new-control)]">
    {tile.thumbUrl ? <img src={tile.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full" />}
    {tile.multi ? <Layers size={16} className="absolute right-1.5 top-1.5 text-white drop-shadow" aria-hidden /> : tile.video ? <Play size={16} fill="currentColor" className="absolute right-1.5 top-1.5 text-white drop-shadow" aria-hidden /> : null}
    {tile.pinned && <Pin size={15} fill="currentColor" className="absolute left-1.5 top-1.5 rotate-45 text-white drop-shadow" aria-label="Pinned" />}
    {tile.kind === 'checkin' ? <TilePill><Check size={11} strokeWidth={3.5} aria-hidden />CHECK-IN</TilePill> : tile.workout ? <TilePill>WORKOUT</TilePill> : null}
  </a>;
}

export function NewSaved() {
  useHideBottomTabs(true, false);
  useEffect(() => dismissToastNow(SAVED_TOAST_ID), []);
  const scroll = useOpenAtTop();
  const router = useRouter();
  const navigate = useNavigate();
  const q = useInfiniteQuery({
    queryKey: savedPostsKey,
    queryFn: ({ pageParam }) => getSavedPosts({ data: { before: pageParam } }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextBefore,
  });
  const tiles = q.data?.pages.flatMap(p => p.items) ?? [];
  const back = () => (router.history.canGoBack() ? router.history.back() : void navigate({ to: '/profile' }));
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-privacy-page fixed inset-0 overflow-y-auto overscroll-none bg-white pb-10" style={{ paddingBottom: 'calc(40px + var(--workout-bar-pad, 0px))' }}>
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><Button variant="ghost" className="new-profile-menu-button" aria-label="Back" onClick={back}><ChevronLeft size={22} /></Button><h1>Saved</h1><span className="new-profile-header-spacer" /></div></header>
    <p className="text-[13px] text-[#57534E]" style={{ padding: '12px 16px 8px' }}>Only you can see what you save.</p>
    {q.isLoading ? <div aria-busy="true" className="grid grid-cols-3 gap-[2px]">{Array.from({ length: 6 }, (_, i) => <span key={i} className="aspect-[4/5] bg-[var(--new-control)]" />)}</div>
      : tiles.length ? <>
        <div className="grid grid-cols-3 gap-[2px]">{tiles.map(t => <PostGridTile key={`${t.kind}:${t.id}`} tile={t} />)}</div>
        {q.hasNextPage && <div className="flex justify-center py-4"><Button variant="ghost" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} className="text-[14px] font-bold text-[var(--new-purple-text)]">{q.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button></div>}
      </>
      : <div className="flex flex-col items-center px-8 pt-20 text-center">
        <Bookmark size={40} strokeWidth={1.75} className="text-[#A8A29E]" aria-hidden />
        <h2 className="mt-3 text-[17px] font-extrabold text-[#1C1917]">Nothing saved yet</h2>
        <p className="mt-1 text-[14px] leading-[1.45] text-[#57534E]">Tap the bookmark on a post or check-in to keep it here.</p>
      </div>}
  </div>;
}
