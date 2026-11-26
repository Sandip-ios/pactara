import { useEffect, useMemo, useRef, useState } from "react";
import { useLaunchHold } from "@/lib/launch-screen";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Video } from "lucide-react";
import type { FeedItem, FeedMeta } from "@/lib/daily-posts.functions";
import { buildFeedDays, type FeedEntry } from "@/lib/feed-days";
import { localDateIn } from "@/lib/streak-rules";
import { TimelineCard, TimelineCardSkeleton } from "@/components/TimelineCard";
import { RedesignPostCard } from "@/components/redesign/RedesignPostCard";
import { crewStreakKept, redesignDayLabel } from "@/lib/redesign-feed-view";
import { FeedContext } from "@/components/feed/feed-context";
import { MilestoneRow, MissedRow, NotYetRow, QuietDayRow, RestedRow } from "@/components/feed/QuietRows";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";
const MUTED = "#57534E";

function EmptyFeed({ onInvite, solo }: { onInvite?: () => void; solo?: boolean }) {
  const navigate = useNavigate();
  // iOS: a click after the keyboard collapses can land at stale coordinates.
  // Navigate on a touch that didn't move, like the Today card.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = () => navigate({ to: "/check-in" });
  return (
    <section className="mx-4 mt-4 flex flex-col items-center rounded-[20px] bg-white px-6 py-8 text-center shadow-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#EDE6FE" }}>
        <Video size={26} style={{ color: PURPLE }} />
      </span>
      <h2 className="mt-4 text-[18px] font-extrabold text-neutral-900">
        {solo ? "Your feed starts with you." : "Be the first one in"}
      </h2>
      <p className="mt-1.5 max-w-[280px] text-[14px]" style={{ color: MUTED }}>
        {solo
          ? "Check in today while we find your accountability partner."
          : "Your crew's check-ins show up here. Post yours and they'll see it right away."}
      </p>
      <button
        type="button"
        onClick={go}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          const start = touch.current;
          touch.current = null;
          if (t && start && Math.hypot(t.clientX - start.x, t.clientY - start.y) < 12) go();
        }}
        className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[26px] text-[16px] font-bold text-white active:scale-[0.99]"
        style={{ background: PURPLE }}
      >
        <Video size={20} />
        Check in with video
      </button>
      {onInvite && !solo && (
        <button type="button" onClick={onInvite} className="mt-2 h-11 px-4 text-[15px] font-semibold" style={{ color: PURPLE }}>
          Invite your crew
        </button>
      )}
    </section>
  );
}

function scrollParentOf(el: HTMLElement): HTMLElement | Window {
  let cur = el.parentElement;
  while (cur && cur !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(cur).overflowY)) return cur;
    cur = cur.parentElement;
  }
  return window;
}

/**
 * iPhone: the sticky day headers sit right under the status bar. Once the feed
 * reaches the top of the screen, a solid page-colored strip covers the status
 * bar area so nothing scrolls visibly behind the clock.
 */
function StatusBarCover({ target, active }: { target: React.RefObject<HTMLElement | null>; active: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const cover = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const el = target.current;
    if (!mounted || !active || !el) return;
    const scroller = scrollParentOf(el);
    const update = () => {
      const inset = cover.current?.offsetHeight ?? 0;
      const r = el.getBoundingClientRect();
      setShow(inset > 0 && r.top < inset && r.bottom > 0);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mounted, active, target]);
  if (!mounted) return null;
  // Portaled: the pull-to-refresh wrapper's transform would pin a fixed child to it.
  return createPortal(
    <div
      ref={cover}
      aria-hidden
      data-status-bar-cover
      className="pointer-events-none fixed inset-x-0 top-0 z-30"
      style={{ height: "env(safe-area-inset-top)", background: BG, visibility: show ? "visible" : "hidden" }}
    />,
    document.body,
  );
}

function Entry({ entry, groupId, autoOpen, redesign = false }: { entry: FeedEntry; groupId: string; autoOpen: boolean; redesign?: boolean }) {
  if (redesign && entry.kind === "checkins") return <RedesignPostCard kind="checkins" item={entry.item} checkIns={entry.checkIns} autoOpenComments={autoOpen} />;
  if (redesign && entry.kind === "update") return <RedesignPostCard kind="update" item={entry.item} node={entry.node} autoOpenComments={autoOpen} />;
  switch (entry.kind) {
    case "checkins":
      return <TimelineCard kind="checkins" item={entry.item} checkIns={entry.checkIns} autoOpenComments={autoOpen} />;
    case "update":
      return <TimelineCard kind="update" item={entry.item} node={entry.node} autoOpenComments={autoOpen} />;
    case "rested":
      return <RestedRow member={entry.member} localDate={entry.localDate} />;
    case "missed":
      return <MissedRow item={entry.item} localDate={entry.localDate} autoOpenComments={autoOpen} />;
    case "not_yet":
      return <NotYetRow member={entry.member} closesAt={entry.closesAt} nudgedAt={entry.nudgedAt} groupId={groupId} />;
    case "milestone":
      return <MilestoneRow member={entry.member} streakDays={entry.streakDays} postId={entry.postId} />;
    case "quiet":
      return <QuietDayRow missed={entry.missed} rested={entry.rested} />;
  }
}

const entryPostId = (e: FeedEntry) => ("item" in e ? e.item.id : null);

/**
 * The Home feed, grouped by day with sticky headers, newest day first. Every
 * day shows its cards in full; older weeks load as the reader nears the bottom.
 */
export function FeedList({
  items,
  meta,
  loading,
  refreshFailed,
  onRetry,
  groupId,
  todayCounts,
  deepLinkPost,
  deepLinkComments,
  onInvite,
  solo = false,
  hasMore = false,
  loadingMore = false,
  loadMoreFailed = false,
  onLoadMore,
  variant = "classic",
}: {
  items: FeedItem[] | undefined;
  meta: FeedMeta | null | undefined;
  loading: boolean;
  refreshFailed: boolean;
  onRetry: () => void;
  groupId: string | null;
  /** Today's "{k} of {n} in", the same numbers as the Today card. */
  todayCounts?: { inCount: number; dueCount: number } | null;
  deepLinkPost?: string;
  deepLinkComments?: boolean;
  onInvite?: () => void;
  /** Solo crew or still waiting for a partner: the empty feed speaks to just you. */
  solo?: boolean;
  /** Older days exist before the oldest loaded one. */
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreFailed?: boolean;
  onLoadMore?: () => void;
  /** The redesign's crew Posts tab: new day headers and post cards, same data and actions. */
  variant?: "classic" | "redesign";
}) {
  const redesign = variant === "redesign";
  const days = useMemo(() => buildFeedDays(items ?? [], meta, localDateIn(Intl.DateTimeFormat().resolvedOptions().timeZone)), [items, meta]);
  const me = meta?.members.find((m) => m.isMe) ?? null;
  const hasPosts = days.some((d) => d.entries.some((e) => e.kind === "checkins" || e.kind === "update"));
  const viewerToday = meta?.viewerToday;
  const feedGroupId = groupId ?? items?.[0]?.groupId ?? "";

  // Load the next 7 days when the reader nears the bottom. A failed load
  // waits for Retry instead of looping.
  const sentinel = useRef<HTMLDivElement>(null);
  const [nearBottom, setNearBottom] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) {
      setNearBottom(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setNearBottom(Boolean(e?.isIntersecting)), {
      rootMargin: "0px 0px 800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, hasPosts, loading]);
  useEffect(() => {
    if (nearBottom && hasMore && !loadingMore && !loadMoreFailed) onLoadMore?.();
  }, [nearBottom, hasMore, loadingMore, loadMoreFailed, onLoadMore]);

  // A notification for an older post: load a few more weeks to find it.
  const deepLinkTries = useRef(0);
  const deepLinkMissing = Boolean(deepLinkPost && items && !items.some((i) => i.id === deepLinkPost));
  useEffect(() => {
    if (!deepLinkMissing || !hasMore || loadingMore || loadMoreFailed || deepLinkTries.current >= 4) return;
    deepLinkTries.current += 1;
    onLoadMore?.();
  }, [deepLinkMissing, hasMore, loadingMore, loadMoreFailed, onLoadMore]);
  // Opened from a notification on a cold start: keep the launch screen up
  // until the linked post is on screen (and its comments open), not Home first.
  useLaunchHold(
    Boolean(deepLinkPost) && (!items || loading || (deepLinkMissing && hasMore && !loadMoreFailed && deepLinkTries.current < 4)),
  );

  const listRef = useRef<HTMLDivElement>(null);

  const loadMoreFooter = hasMore ? (
    <div ref={sentinel}>
      {loadMoreFailed ? (
        <div className="flex flex-col items-center px-6 pb-4 pt-6 text-center">
          <div className="text-[14px]" style={{ color: MUTED }}>Couldn't load older days</div>
          <button
            type="button"
            onClick={() => onLoadMore?.()}
            className="mt-1 h-11 px-4 text-[15px] font-semibold"
            style={{ color: PURPLE }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div aria-busy="true" aria-label="Loading older days">
          <TimelineCardSkeleton />
        </div>
      )}
    </div>
  ) : null;

  const banner = refreshFailed && (
    <div
      className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ background: "#FEF2F2", borderColor: "#FECACA" }}
      role="status"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold" style={{ color: "#991B1B" }}>Couldn't refresh the feed</div>
        <div className="text-[13px]" style={{ color: "#7F1D1D" }}>Showing what you last saw</div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="h-9 shrink-0 rounded-full border bg-white px-4 text-[14px] font-bold"
        style={{ borderColor: "#FECACA", color: "#991B1B" }}
      >
        Retry
      </button>
    </div>
  );

  if (loading && !items) {
    return (
      <div className="pb-2" aria-busy="true" aria-label="Loading feed">
        <div className="mx-4 mt-5 h-4 w-32 animate-pulse rounded bg-neutral-200" />
        <TimelineCardSkeleton />
        <TimelineCardSkeleton />
      </div>
    );
  }

  if (!hasPosts) {
    return (
      <div className="pb-2">
        {banner}
        {hasMore ? loadMoreFooter : items && <EmptyFeed onInvite={onInvite} solo={solo} />}
      </div>
    );
  }

  const anchored = new Set<string>();
  return (
    <FeedContext.Provider value={{ me, weeklyTarget: meta?.weeklyTarget ?? 5 }}>
      <StatusBarCover target={listRef} active={hasPosts && !redesign} />
      <div ref={listRef} className="pb-2">
        {banner}
        {days.map((day) => {
          const isToday = day.date === viewerToday;
          const counts =
            isToday && todayCounts
              ? { in: todayCounts.inCount, due: todayCounts.dueCount }
              : day.stat
                ? { in: day.stat.checkedIn.length, due: day.stat.due }
                : null;
          return (
            <section key={day.date} aria-label={day.label}>
              {redesign ? (
                <div className="flex items-center gap-2.5" style={{ padding: "18px 16px 8px" }}>
                  <h2 className="shrink-0 text-[13px] font-extrabold" style={{ color: MUTED, letterSpacing: "0.6px" }}>
                    {redesignDayLabel(day.date, viewerToday ?? day.date)}
                  </h2>
                  <span className="h-px flex-1" style={{ background: "#E7E3DE" }} aria-hidden />
                  {isToday
                    ? counts && counts.due > 0 && (
                        <span className="shrink-0 text-[13px] font-bold" style={{ color: MUTED }}>{Math.min(counts.in, counts.due)} of {counts.due} in</span>
                      )
                    : crewStreakKept(day.stat) && <span className="shrink-0 text-[13px] font-bold" style={{ color: "#15803D" }}>Crew streak kept</span>}
                </div>
              ) : (
              <div
                className="sticky z-10 flex items-baseline justify-between px-4 pb-1.5 pt-4"
                style={{ top: "env(safe-area-inset-top)", background: BG }}
              >
                <h2 className="text-[15px] font-extrabold text-neutral-900">{day.label}</h2>
                {counts && counts.due > 0 && (
                  <span className="text-[13px]" style={{ color: MUTED }}>
                    {Math.min(counts.in, counts.due)} of {counts.due} in
                  </span>
                )}
              </div>
              )}
              {day.entries.map((entry) => {
                const pid = entry.kind === "quiet"
                  ? entry.missedItems.find((i) => i.id === deepLinkPost)?.id ?? null
                  : entryPostId(entry);
                const first = pid && !anchored.has(pid);
                if (pid) anchored.add(pid);
                const canOpen = entry.kind === "checkins" || entry.kind === "update" || entry.kind === "missed";
                const autoOpen = Boolean(first && deepLinkComments && deepLinkPost === pid);
                return (
                  <div key={entry.key} id={first ? `post-${pid}` : undefined}>
                    {entry.kind === "quiet" ? (
                      <QuietDayRow
                        missed={entry.missed}
                        rested={entry.rested}
                        autoOpenItem={autoOpen ? entry.missedItems.find((i) => i.id === pid) : undefined}
                      />
                    ) : (
                      <Entry entry={entry} groupId={feedGroupId} autoOpen={autoOpen && canOpen} redesign={redesign} />
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
        {hasMore ? (
          loadMoreFooter
        ) : (
          <div className="px-6 pb-4 pt-8 text-center">
            <div className="text-[17px] font-bold text-neutral-900">You're all caught up</div>
            <div className="mt-1 text-[13px]" style={{ color: MUTED }}>
              Older days are on each person's profile.
            </div>
          </div>
        )}
      </div>
    </FeedContext.Provider>
  );
}
