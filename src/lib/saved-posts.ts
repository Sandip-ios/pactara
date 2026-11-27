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
