/**
 * Turns the group feed into days for Home: post cards (check-ins swipe
 * together, each update is its own card), quiet rows (not yet, rested,
 * missed, milestone) and the collapsed summary for older days.
 */
import type { FeedItem, FeedMember, FeedMeta, TimelineNode } from "@/lib/daily-posts.functions";
import { dayHeaderLabel, feedDayKey, isCollapsedDay, type DayStat } from "@/lib/feed-view";

export type CheckInNode = Extract<TimelineNode, { kind: "check_in" }>;
export type UpdateNode = Extract<TimelineNode, { kind: "thought" | "ritual" }>;

export type FeedEntry =
  | { kind: "checkins"; key: string; item: FeedItem; checkIns: CheckInNode[] }
  | { kind: "update"; key: string; item: FeedItem; node: UpdateNode }
  | { kind: "rested"; key: string; item: FeedItem; localDate: string }
  | { kind: "missed"; key: string; item: FeedItem; localDate: string }
  | { kind: "not_yet"; key: string; member: FeedMember; closesAt: string; nudgedAt: string | null }
  | { kind: "milestone"; key: string; member: FeedMember; streakDays: number; postId: string | null; localDate: string };

export type FeedDay = {
  date: string;
  label: string;
  collapsed: boolean;
  entries: FeedEntry[];
  stat: DayStat | null;
  checkInCount: number;
  cheers: number;
  comments: number;
  /** Up to 4 media thumbnails (photos or video poster frames). */
  thumbs: string[];
};

const VIDEO_RE = /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i;
const at = (iso: string | undefined) => (iso ? Date.parse(iso) || 0 : 0);
const ORDER: Record<FeedEntry["kind"], number> = {
  milestone: 0,
  checkins: 1,
  update: 1,
  not_yet: 2,
  rested: 3,
  missed: 4,
};

export function buildFeedDays(items: FeedItem[], meta: FeedMeta | null | undefined, fallbackToday: string): FeedDay[] {
  const viewerToday = meta?.viewerToday ?? fallbackToday;
  const members = new Map((meta?.members ?? []).map((m) => [m.userId, m]));
  const byDay = new Map<string, { entries: (FeedEntry & { sortAt: number })[]; items: Set<FeedItem> }>();
  const dayFor = (date: string) => {
    const key = feedDayKey(date, viewerToday);
    let d = byDay.get(key);
    if (!d) byDay.set(key, (d = { entries: [], items: new Set() }));
    return d;
  };

  for (const item of items) {
    const day = dayFor(item.localDate);
    day.items.add(item);
    const checkIns = item.nodes.filter((n): n is CheckInNode => n.kind === "check_in");
    if (checkIns.length) {
      day.entries.push({
        kind: "checkins",
        key: `ci-${item.id}`,
        item,
        checkIns,
        sortAt: Math.max(...checkIns.map((c) => at(c.at))),
      });
    }
    for (const n of item.nodes) {
      if (n.kind === "thought" || n.kind === "ritual") {
        day.entries.push({ kind: "update", key: `up-${n.id}`, item, node: n, sortAt: at(n.at) });
      } else if (n.kind === "rested") {
        day.entries.push({ kind: "rested", key: `rest-${item.id}`, item, localDate: n.localDate, sortAt: 0 });
      } else if (n.kind === "check_in_missed") {
        day.entries.push({ kind: "missed", key: `miss-${item.id}`, item, localDate: n.localDate, sortAt: 0 });
      }
    }
  }

  for (const n of meta?.notYet ?? []) {
    const member = members.get(n.userId);
    if (!member) continue;
    dayFor(viewerToday).entries.push({ kind: "not_yet", key: `ny-${n.userId}`, member, closesAt: n.closesAt, nudgedAt: n.nudgedAt, sortAt: 0 });
  }
  for (const m of meta?.milestones ?? []) {
    const member = members.get(m.userId);
    if (!member) continue;
    dayFor(m.localDate).entries.push({
      kind: "milestone",
      key: `ms-${m.id}`,
      member,
      streakDays: m.streakDays,
      postId: m.postId,
      localDate: m.localDate,
      sortAt: 0,
    });
  }

  const stats = new Map((meta?.days ?? []).map((d) => [d.date, d]));
  return Array.from(byDay.entries())
    .filter(([, d]) => d.entries.length > 0)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, d]) => {
      const entries = d.entries
        .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || b.sortAt - a.sortAt)
        .map(({ sortAt: _s, ...e }) => e as FeedEntry);
      const dayItems = [...d.items];
      const checkInNodes = entries.flatMap((e) => (e.kind === "checkins" ? e.checkIns : []));
      const thumbs = checkInNodes
        .map((c) => c.posterUrl ?? (c.photoUrl && !VIDEO_RE.test(c.photoUrl) ? c.photoUrl : null))
        .filter((u): u is string => !!u)
        .slice(0, 4);
      return {
        date,
        label: dayHeaderLabel(date, viewerToday),
        collapsed: isCollapsedDay(date, viewerToday),
        entries,
        stat: stats.get(date) ?? null,
        checkInCount: checkInNodes.length,
        cheers: dayItems.reduce((sum, i) => sum + i.reactors.length, 0),
        comments: dayItems.reduce((sum, i) => sum + i.commentCount, 0),
        thumbs,
      };
    });
}
