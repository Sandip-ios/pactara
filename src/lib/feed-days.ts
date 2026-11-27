/**
 * Turns the group feed into days for Home: post cards (check-ins swipe
 * together, each update is its own card) and quiet rows. Today keeps one row
 * per person (not yet, rested, missed), rest days included even without a post;
 * past days get one combined quiet row.
 * Milestones stay individual on every day. Nothing collapses.
 */
import type { FeedItem, FeedMember, FeedMeta, GroupFeedPage, TimelineNode } from "@/lib/daily-posts.functions";
import { dayHeaderLabel, feedDayKey, type DayStat } from "@/lib/feed-view";

export type CheckInNode = Extract<TimelineNode, { kind: "check_in" }>;
export type UpdateNode = Extract<TimelineNode, { kind: "thought" | "ritual" }>;

export type FeedEntry =
  | { kind: "checkins"; key: string; item: FeedItem; checkIns: CheckInNode[] }
  | { kind: "update"; key: string; item: FeedItem; node: UpdateNode }
  | { kind: "rested"; key: string; member: FeedMember; localDate: string }
  | { kind: "missed"; key: string; item: FeedItem; localDate: string }
  | { kind: "not_yet"; key: string; member: FeedMember; closesAt: string; nudgedAt: string | null }
  | { kind: "milestone"; key: string; member: FeedMember; streakDays: number; postId: string | null; localDate: string }
  /** Past days only: everyone who missed, then everyone who rested, in one row. */
  | { kind: "quiet"; key: string; missed: FeedMember[]; rested: FeedMember[]; missedItems: FeedItem[] };

export type FeedDay = {
  date: string;
  label: string;
  entries: FeedEntry[];
  stat: DayStat | null;
};

const at = (iso: string | undefined) => (iso ? Date.parse(iso) || 0 : 0);
const ORDER: Record<FeedEntry["kind"], number> = {
  milestone: 0,
  checkins: 1,
  update: 1,
  not_yet: 2,
  rested: 3,
  missed: 4,
  quiet: 5,
};

const memberFromItem = (item: FeedItem): FeedMember => ({
  userId: item.userId,
  name: item.name,
  firstName: (item.name || "").split(" ")[0] || "Member",
  avatarUrl: item.avatarUrl,
  avatarColor: item.avatarColor,
  isMe: item.isMe,
});

/** Others by first name, you last. */
const orderPeople = (people: FeedMember[]) =>
  [...people].sort((a, b) => Number(a.isMe) - Number(b.isMe) || a.firstName.localeCompare(b.firstName));

/** `split`: the new version gives every check-in its own card. Classic keeps one card per member per day. */
export function buildFeedDays(items: FeedItem[], meta: FeedMeta | null | undefined, fallbackToday: string, opts: { split?: boolean } = {}): FeedDay[] {
  const viewerToday = meta?.viewerToday ?? fallbackToday;
  const members = new Map((meta?.members ?? []).map((m) => [m.userId, m]));
  // Today's rest rows, one per person, from their post or from the crew's rest days.
  const restedToday = new Map<string, { member: FeedMember; localDate: string }>();
  type Bucket = {
    entries: (FeedEntry & { sortAt: number })[];
    missed: Map<string, FeedItem>;
    rested: Map<string, FeedMember>;
  };
  const byDay = new Map<string, Bucket>();
  const dayFor = (date: string) => {
    const key = feedDayKey(date, viewerToday);
    let d = byDay.get(key);
    if (!d) byDay.set(key, (d = { entries: [], missed: new Map(), rested: new Map() }));
    return d;
  };

  for (const item of items) {
    const day = dayFor(item.localDate);
    const isPast = feedDayKey(item.localDate, viewerToday) < viewerToday;
    const checkIns = item.nodes.filter((n): n is CheckInNode => n.kind === "check_in");
    if (checkIns.length && opts.split) {
      for (const c of checkIns) day.entries.push({ kind: "checkins", key: `ci-${c.id}`, item, checkIns: [c], sortAt: at(c.at) });
    } else if (checkIns.length) {
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
        if (isPast) day.rested.set(item.userId, members.get(item.userId) ?? memberFromItem(item));
        else if (!restedToday.has(item.userId)) {
          restedToday.set(item.userId, { member: members.get(item.userId) ?? memberFromItem(item), localDate: n.localDate });
        }
      } else if (n.kind === "check_in_missed") {
        if (isPast) day.missed.set(item.userId, item);
        else day.entries.push({ kind: "missed", key: `miss-${item.id}`, item, localDate: n.localDate, sortAt: 0 });
      }
    }
  }

  // Rest and freeze days on past days come from the crew's day stats too, so a
  // rest day shows even when it has no post of its own.
  const stats = new Map((meta?.days ?? []).map((d) => [d.date, d]));
  for (const stat of stats.values()) {
    if (stat.date >= viewerToday || stat.rested.length === 0) continue;
    const day = dayFor(stat.date);
    for (const id of stat.rested) {
      const m = members.get(id);
      if (m && !day.missed.has(id)) day.rested.set(id, m);
    }
  }

  for (const id of meta?.restingToday ?? []) {
    const member = members.get(id);
    if (member && !restedToday.has(id)) restedToday.set(id, { member, localDate: viewerToday });
  }
  for (const [id, r] of restedToday) {
    dayFor(viewerToday).entries.push({ kind: "rested", key: `rest-${id}`, member: r.member, localDate: r.localDate, sortAt: 0 });
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

  for (const [date, d] of byDay) {
    if (d.missed.size === 0 && d.rested.size === 0) continue;
    const missedItems = [...d.missed.values()];
    d.entries.push({
      kind: "quiet",
      key: `quiet-${date}`,
      missed: orderPeople(missedItems.map((i) => members.get(i.userId) ?? memberFromItem(i))),
      rested: orderPeople([...d.rested.values()]),
      missedItems,
      sortAt: 0,
    });
  }

  return Array.from(byDay.entries())
    .filter(([, d]) => d.entries.length > 0)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, d]) => ({
      date,
      label: dayHeaderLabel(date, viewerToday),
      entries: d.entries
        .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || b.sortAt - a.sortAt)
        .map(({ sortAt: _s, ...e }) => e as FeedEntry),
      stat: stats.get(date) ?? null,
    }));
}

/**
 * Joins loaded feed pages (newest first) into one list. Today-only data and the
 * viewer's settings come from the newest page that has any.
 */
export function mergeFeedPages(pages: GroupFeedPage[]): { items: FeedItem[]; meta: FeedMeta | null } {
  const items = pages.flatMap((p) => p.items);
  const metas = pages.map((p) => p.meta).filter((m): m is FeedMeta => !!m);
  const base = metas[0];
  if (!base) return { items, meta: null };
  const members = new Map<string, FeedMember>();
  for (const m of metas) for (const person of m.members) if (!members.has(person.userId)) members.set(person.userId, person);
  return {
    items,
    meta: {
      ...base,
      members: [...members.values()],
      days: metas.flatMap((m) => m.days),
      milestones: metas.flatMap((m) => m.milestones),
      notYet: base.notYet,
      restingToday: base.restingToday ?? [],
    },
  };
}
