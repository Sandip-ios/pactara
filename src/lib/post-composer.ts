/** Pure rules for the New post picker, editor and composer. */
export const MAX_POST_ITEMS = 10;
export const DISCOVER_MAX_VIDEO_S = 180;

export type DraftCrop = { aspect: "4:5" | "3:4" | "original"; y: number };
export type DraftItem = {
  id: string;
  kind: "photo" | "video";
  duration: number | null;
  trimStart: number;
  trimEnd: number | null;
  muted: boolean;
  cover: number;
  crop: DraftCrop;
};

/** Tap in multi-select: add to the end, or remove and renumber. Caps at 10. */
export function toggleSelection(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (selected.length >= MAX_POST_ITEMS) return selected;
  return [...selected, id];
}

/** The numbered badge on a tile, 1-based; null when not picked. */
export function selectionNumber(selected: string[], id: string): number | null {
  const i = selected.indexOf(id);
  return i < 0 ? null : i + 1;
}

/** "0:12", "1:05". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function trimmedLength(item: Pick<DraftItem, "duration" | "trimStart" | "trimEnd">): number {
  const end = item.trimEnd ?? item.duration ?? 0;
  return Math.max(0, end - item.trimStart);
}

/** "Trimmed to 0:12 of 0:18". */
export function trimLabel(item: Pick<DraftItem, "duration" | "trimStart" | "trimEnd">): string {
  return `Trimmed to ${formatClock(trimmedLength(item))} of ${formatClock(item.duration ?? 0)}`;
}

/** "3 items · hold and drag to reorder". */
export function itemsStripLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"} · hold and drag to reorder`;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, it as T);
  return next;
}

/** Any video over 3 minutes (after trim) keeps the post out of Discover. */
export function skipsDiscover(items: Pick<DraftItem, "kind" | "duration" | "trimStart" | "trimEnd">[]): boolean {
  return items.some((i) => i.kind === "video" && trimmedLength(i) > DISCOVER_MAX_VIDEO_S);
}

/** Back on Compose asks "Discard this post?" only when something would be lost. */
export function composerIsDirty(d: { items: number; caption: string; workoutAttached: boolean }): boolean {
  return d.items > 0 || d.caption.trim().length > 0 || d.workoutAttached;
}

/** "46 min · 20 sets · 2 personal bests" for the Share workout card. */
export function shareWorkoutStats(w: { minutes: number; sets: number; prs: number }): string {
  const parts = [...(w.minutes > 0 ? [`${w.minutes} min`] : []), `${w.sets} ${w.sets === 1 ? "set" : "sets"}`];
  if (w.prs > 0) parts.push(`${w.prs} ${w.prs === 1 ? "personal best" : "personal bests"}`);
  return parts.join(" · ");
}

/** "Credits Maya. They get a notification." */
export function creditLine(firstName: string): string {
  return `Credits ${firstName}. They get a notification.`;
}

/** Upload limits for library posts. */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const CREW_MAX_VIDEO_S = 180;
export const EVERYONE_MAX_VIDEO_S = 600;

/** A file over 200 MB is refused when picked, with a message instead of a silent failure. */
export function fileTooBigMessage(bytes: number): string | null {
  return bytes > MAX_FILE_BYTES ? "This file is too big to post. Pick one under 200 MB." : null;
}

/** Crew-only videos up to 3:00, Everyone up to 10:00 (after trim). Null when it can post. */
export function videoLengthError(items: Pick<DraftItem, "kind" | "duration" | "trimStart" | "trimEnd">[], everyone: boolean): string | null {
  const total = items.filter(i => i.kind === "video").reduce((n, i) => n + trimmedLength(i), 0);
  if (total > EVERYONE_MAX_VIDEO_S + 0.5 && items.filter(i => i.kind === "video").length > 1) return "Videos can be up to 10:00 total. Trim them to post.";
  const max = everyone ? EVERYONE_MAX_VIDEO_S : CREW_MAX_VIDEO_S;
  const long = items.find((i) => i.kind === "video" && trimmedLength(i) > max + 0.5);
  if (!long) return null;
  const len = formatClock(trimmedLength(long));
  return everyone
    ? `This video is ${len}. Videos can be up to 10:00. Trim it to post.`
    : `This video is ${len}. Crew-only posts take videos up to 3:00. Trim it or choose Everyone.`;
}
