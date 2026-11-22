import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Video } from "lucide-react";
import type { FeedItem, FeedMeta } from "@/lib/daily-posts.functions";
import { buildFeedDays, type FeedDay, type FeedEntry } from "@/lib/feed-days";
import { daySummary } from "@/lib/feed-view";
import { localDateIn } from "@/lib/streak-rules";
import { TimelineCard, TimelineCardSkeleton } from "@/components/TimelineCard";
import { FeedAvatar } from "@/components/feed/FeedMedia";
import { FeedContext } from "@/components/feed/feed-context";
import { MilestoneRow, MissedRow, NotYetRow, RestedRow } from "@/components/feed/QuietRows";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";
const MUTED = "#57534E";

function EmptyFeed({ onInvite }: { onInvite?: () => void }) {
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
      <h2 className="mt-4 text-[18px] font-extrabold text-neutral-900">Be the first one in</h2>
      <p className="mt-1.5 max-w-[280px] text-[14px]" style={{ color: MUTED }}>
        Your crew's check-ins show up here. Post yours and they'll see it right away.
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
      {onInvite && (
        <button type="button" onClick={onInvite} className="mt-2 h-11 px-4 text-[15px] font-semibold" style={{ color: PURPLE }}>
          Invite your crew
        </button>
      )}
    </section>
  );
}

function DaySummaryCard({ day, meta, onExpand }: { day: FeedDay; meta: FeedMeta | null; onExpand: () => void }) {
  const people = new Map((meta?.members ?? []).map((m) => [m.userId, m]));
  const nameOf = (id: string) => ({ firstName: people.get(id)?.firstName ?? "Member", isMe: !!people.get(id)?.isMe });
  const stat = day.stat;
  const summary = stat ? daySummary(stat, nameOf) : null;
  const faces = (stat?.checkedIn ?? []).map((id) => people.get(id)).filter(Boolean).slice(0, 5);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  if (summary?.everyoneIn) {
    return (
      <section className="mx-4 mt-1 rounded-[20px] p-4" style={{ background: "#E8F6EC" }}>
        <div className="flex items-center">
          {faces.map((m, i) => (
            <span key={m!.userId} className="relative" style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}>
              <FeedAvatar url={m!.avatarUrl} color={m!.avatarColor} name={m!.name} size={30} className="border-2 border-white" />
            </span>
          ))}
        </div>
        <h3 className="mt-2.5 text-[16px] font-extrabold text-neutral-900">Everyone showed up</h3>
        <p className="mt-0.5 text-[13px]" style={{ color: MUTED }}>
          Crew streak: {plural(stat!.groupStreak, "day")} · {plural(day.cheers, "cheer")} · {plural(day.comments, "comment")}
        </p>
        {day.thumbs.length > 0 && (
          <div className="mt-3 flex gap-2">
            {day.thumbs.map((t) => (
              <img key={t} src={t} alt="" loading="lazy" className="h-14 w-14 rounded-xl object-cover" />
            ))}
          </div>
        )}
        <button type="button" onClick={onExpand} className="mt-2 h-11 text-[14px] font-bold" style={{ color: "#15803D" }}>
          See all {plural(day.checkInCount, "check-in")}
        </button>
      </section>
    );
  }

  return (
    <section className="mx-4 mt-1 flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold text-neutral-900">{summary?.title ?? `${plural(day.checkInCount, "check-in")}`}</h3>
        {summary?.subline && (
          <p className="mt-0.5 truncate text-[13px]" style={{ color: MUTED }}>
            {summary.subline}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onExpand}
        className="h-9 shrink-0 rounded-full px-4 text-[14px] font-bold text-white"
        style={{ background: PURPLE }}
      >
        Expand
      </button>
    </section>
  );
}

function Entry({ entry, groupId, autoOpen }: { entry: FeedEntry; groupId: string; autoOpen: boolean }) {
  switch (entry.kind) {
    case "checkins":
      return <TimelineCard kind="checkins" item={entry.item} checkIns={entry.checkIns} autoOpenComments={autoOpen} />;
    case "update":
      return <TimelineCard kind="update" item={entry.item} node={entry.node} autoOpenComments={autoOpen} />;
    case "rested":
      return <RestedRow item={entry.item} localDate={entry.localDate} />;
    case "missed":
      return <MissedRow item={entry.item} localDate={entry.localDate} autoOpenComments={autoOpen} />;
    case "not_yet":
      return <NotYetRow member={entry.member} closesAt={entry.closesAt} nudgedAt={entry.nudgedAt} groupId={groupId} />;
    case "milestone":
      return <MilestoneRow member={entry.member} streakDays={entry.streakDays} postId={entry.postId} />;
  }
}

const entryPostId = (e: FeedEntry) => ("item" in e ? e.item.id : null);

/**
 * The Home feed, grouped by day with sticky headers. Today and yesterday show
 * full cards; older days collapse into one summary card until expanded.
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
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const days = useMemo(() => buildFeedDays(items ?? [], meta, localDateIn(Intl.DateTimeFormat().resolvedOptions().timeZone)), [items, meta]);
  const me = meta?.members.find((m) => m.isMe) ?? null;
  const hasPosts = days.some((d) => d.entries.some((e) => e.kind === "checkins" || e.kind === "update"));
  const viewerToday = meta?.viewerToday;
  const feedGroupId = groupId ?? items?.[0]?.groupId ?? "";

  // A notification for a post on an older day opens that day.
  useEffect(() => {
    if (!deepLinkPost) return;
    const day = days.find((d) => d.collapsed && d.entries.some((e) => entryPostId(e) === deepLinkPost));
    if (day) setExpanded((prev) => new Set(prev).add(day.date));
  }, [deepLinkPost, days]);

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
        {items && <EmptyFeed onInvite={onInvite} />}
      </div>
    );
  }

  const anchored = new Set<string>();
  return (
    <FeedContext.Provider value={{ me, weeklyTarget: meta?.weeklyTarget ?? 5 }}>
      <div className="pb-2">
        {banner}
        {days.map((day) => {
          const isToday = day.date === viewerToday;
          const counts =
            isToday && todayCounts
              ? { in: todayCounts.inCount, due: todayCounts.dueCount }
              : day.stat
                ? { in: day.stat.checkedIn.length, due: day.stat.due }
                : null;
          const open = !day.collapsed || expanded.has(day.date);
          return (
            <section key={day.date} aria-label={day.label}>
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
              {open ? (
                day.entries.map((entry) => {
                  const pid = entryPostId(entry);
                  const first = pid && !anchored.has(pid);
                  if (pid) anchored.add(pid);
                  const canOpen = entry.kind === "checkins" || entry.kind === "update" || entry.kind === "missed";
                  return (
                    <div key={entry.key} id={first ? `post-${pid}` : undefined}>
                      <Entry
                        entry={entry}
                        groupId={feedGroupId}
                        autoOpen={Boolean(first && canOpen && deepLinkComments && deepLinkPost === pid)}
                      />
                    </div>
                  );
                })
              ) : (
                <DaySummaryCard
                  day={day}
                  meta={meta ?? null}
                  onExpand={() => setExpanded((prev) => new Set(prev).add(day.date))}
                />
              )}
            </section>
          );
        })}
        <div className="px-6 pb-4 pt-8 text-center">
          <div className="text-[17px] font-bold text-neutral-900">You're all caught up</div>
          <div className="mt-1 text-[13px]" style={{ color: MUTED }}>
            Older days are on each person's profile.
          </div>
        </div>
      </div>
    </FeedContext.Provider>
  );
}
