import { useSyncExternalStore } from "react";
import type { DraftItem } from "./post-composer";
import { MAX_POST_ITEMS } from "./post-composer";

/** Session-only state for the New post flow; files never leave memory until Share. */
export type DraftMedia = { id: string; file: Blob; url: string; kind: "photo" | "video"; duration: number | null; name: string };
export type PostDraft = {
  library: DraftMedia[];
  /** Picked ids, in order. */
  selected: string[];
  /** Edit settings per picked id. */
  edits: Record<string, DraftItem>;
  caption: string;
  /** Opened from a workout's Share: that workout is attached. */
  shareWorkout: { workoutId: string | null; sessionId: string | null } | null;
};

const empty = (): PostDraft => ({ library: [], selected: [], edits: {}, caption: "", shareWorkout: null });
let state: PostDraft = empty();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getDraft() { return state; }
export function setDraft(patch: Partial<PostDraft> | ((d: PostDraft) => Partial<PostDraft>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  emit();
}
export function resetDraft(shareWorkout: PostDraft["shareWorkout"] = null) {
  for (const m of state.library) URL.revokeObjectURL(m.url);
  state = { ...empty(), shareWorkout };
  emit();
}
export function usePostDraft(): PostDraft {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

export function defaultEdit(m: DraftMedia): DraftItem {
  return { id: m.id, kind: m.kind, duration: m.duration, trimStart: 0, trimEnd: m.duration, muted: false, cover: 0, crop: { aspect: "4:5", y: 0.5 } };
}

/** The picked media in order, with their edits. */
export type PickedItem = { media: DraftMedia; edit: DraftItem };
export function pickedItems(d: PostDraft): PickedItem[] {
  return d.selected
    .map((id) => d.library.find((m) => m.id === id))
    .filter((m): m is DraftMedia => !!m)
    .map((m) => ({ media: m, edit: d.edits[m.id] ?? defaultEdit(m) }));
}

async function probeDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const t = window.setTimeout(() => resolve(null), 5000);
    v.onloadedmetadata = () => { window.clearTimeout(t); resolve(Number.isFinite(v.duration) ? v.duration : null); };
    v.onerror = () => { window.clearTimeout(t); resolve(null); };
    v.src = url;
  });
}

/** Add files to the library; newest first. Returns the new ids. */
export async function addFiles(files: { blob: Blob; name: string }[]): Promise<string[]> {
  const added: DraftMedia[] = [];
  for (const f of files) {
    const kind = f.blob.type.startsWith("video/") || /\.(mov|mp4|m4v|webm)$/i.test(f.name) ? "video" : "photo";
    if (kind === "photo" && !f.blob.type.startsWith("image/") && !/\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name)) continue;
    const url = URL.createObjectURL(f.blob);
    const duration = kind === "video" ? await probeDuration(url) : null;
    added.push({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, file: f.blob, url, kind, duration, name: f.name });
  }
  setDraft((d) => ({ library: [...added, ...d.library] }));
  return added.map((a) => a.id);
}

export { MAX_POST_ITEMS };
