/** Saved › Posts: pure merge of saved posts and saved check-ins, newest saved first. */
export const SAVED_PAGE_SIZE = 30;

export type SavedTile = {
  kind: "post" | "checkin";
  id: string;
  savedAt: string;
  thumbUrl: string | null;
  video: boolean;
  multi: boolean;
  workout: boolean;
  /** Pinned to the profile; only the profile grid sets it, never Saved. */
  pinned?: boolean;
  /** Where tapping the tile goes. */
  href: string;
  label: string;
};

export type SavedRef = { kind: "post" | "checkin"; id: string; savedAt: string };

/** Newest saved first, ties by id so pages never repeat or skip. */
export function mergeSaved(posts: SavedRef[], checkIns: SavedRef[], limit = SAVED_PAGE_SIZE): { page: SavedRef[]; more: boolean } {
  const all = [...posts, ...checkIns].sort((a, b) => (a.savedAt === b.savedAt ? (a.id < b.id ? 1 : -1) : a.savedAt < b.savedAt ? 1 : -1));
  return { page: all.slice(0, limit), more: all.length > limit };
}

/** Drop refs whose item is gone or no longer visible, keeping order. */
export function keepVisible<T extends SavedRef>(refs: T[], visible: Set<string>): T[] {
  return refs.filter((r) => visible.has(`${r.kind}:${r.id}`));
}

type GridPost = { id: string; caption: string; createdAt: string; pinnedAt: string | null; workout: { title?: string } | null; items: { kind: "photo" | "video"; url: string | null; posterUrl: string | null }[] };

/** Profile Posts grid: pinned first (newest pin first), then newest posts. */
export function profileGridTiles(posts: GridPost[], fallbackLabel = "Post"): SavedTile[] {
  const sorted = [...posts].sort((a, b) => {
    if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
    if (a.pinnedAt && b.pinnedAt && a.pinnedAt !== b.pinnedAt) return a.pinnedAt < b.pinnedAt ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
  return sorted.map((p) => {
    const first = p.items[0];
    return {
      kind: "post", id: p.id, savedAt: p.createdAt,
      thumbUrl: first ? (first.kind === "video" ? first.posterUrl : first.url) : null,
      video: first?.kind === "video", multi: p.items.length > 1, workout: !!p.workout, pinned: !!p.pinnedAt,
      href: `/post/${p.id}`, label: p.caption || p.workout?.title || fallbackLabel,
    };
  });
}
