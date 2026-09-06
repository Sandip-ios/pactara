import type { FeedItem, TimelineNode } from "@/lib/daily-posts.functions";

const TIMELINE_DAY_START_HOUR = 0;

function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timelineDateFor(iso: string) {
  const d = new Date(iso);
  d.setHours(d.getHours() - TIMELINE_DAY_START_HOUR);
  return formatLocalDate(d);
}

function nodeTimelineDate(item: FeedItem, node: TimelineNode) {
  if (node.kind === "pending" || node.kind === "ritual_missed" || node.kind === "check_in_missed") {
    return item.localDate;
  }
  return timelineDateFor(node.at);
}

/**
 * Groups raw feed items into one timeline card per member per day, matching
 * the Home feed's card model. Shared so a single group's Activity tab renders
 * identically to Home.
 */
export function splitFeedIntoTimelineCards(items: FeedItem[]): FeedItem[] {
  const grouped = new Map<string, FeedItem>();

  for (const item of items) {
    const nodes =
      item.nodes.length > 0 ? item.nodes : [{ kind: "pending", id: `empty-${item.id}` } as TimelineNode];
    for (const node of nodes) {
      const localDate = nodeTimelineDate(item, node);
      const key = `${item.userId}-${localDate}`;
      const nodeAt = "at" in node ? node.at : item.updatedAt;
      const existing = grouped.get(key);

      if (existing) {
        existing.nodes.push(node);
        if (existing.updatedAt < nodeAt) existing.updatedAt = nodeAt;
      } else {
        grouped.set(key, { ...item, id: item.id, localDate, updatedAt: nodeAt, nodes: [node] });
      }
    }
  }

  for (const card of grouped.values()) {
    const hasRitual = card.nodes.some((n) => n.kind === "ritual");
    if (!hasRitual) continue;
    const hasCheckInState = card.nodes.some(
      (n) => n.kind === "check_in" || n.kind === "check_in_missed" || n.kind === "pending",
    );
    if (!hasCheckInState) {
      card.nodes.push({ kind: "pending", id: `p-${card.id}` } as TimelineNode);
    }
  }

  for (const card of grouped.values()) {
    card.nodes.sort((a, b) => {
      const aRit = a.kind === "ritual" || a.kind === "ritual_missed" ? 0 : 1;
      const bRit = b.kind === "ritual" || b.kind === "ritual_missed" ? 0 : 1;
      if (aRit !== bRit) return aRit - bRit;
      const aAt = "at" in a ? a.at : "";
      const bAt = "at" in b ? b.at : "";
      if (!aAt && !bAt) return 0;
      if (!aAt) return 1;
      if (!bAt) return -1;
      return aAt < bAt ? 1 : aAt > bAt ? -1 : 0;
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.localDate !== b.localDate) return a.localDate < b.localDate ? 1 : -1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}
