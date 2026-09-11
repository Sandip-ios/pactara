import type { FeedItem, TimelineNode } from "@/lib/daily-posts.functions";

// The server already assigns every node to the author's local day. Re-deriving
// the day from each node's timestamp in the viewer's timezone splits a single
// day into two cards (e.g. a late-evening check-in landing on the next day),
// so always group by the item's own local date.
function nodeTimelineDate(item: FeedItem, _node: TimelineNode) {
  return item.localDate;
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
      const key = node.kind === "thought" ? `${item.userId}-${localDate}-${node.id}` : `${item.userId}-${localDate}`;
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
