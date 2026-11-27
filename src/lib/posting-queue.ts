import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { finalizeSocialPost } from "./posts.functions";

/**
 * Background "Posting..." queue. Each job's blobs are kept in IndexedDB so an
 * upload interrupted by the app going to the background resumes on return.
 */
export type QueueFile = { path: string; blob: Blob; contentType: string; done: boolean };
export type PostJob = { postId: string; label: string; thumb: Blob | null; thumbKind?: "photo" | "video"; files: QueueFile[]; failed: boolean };
export type StripState = { postId: string; label: string; thumbUrl: string | null; thumbKind?: "photo" | "video"; progress: number; failed: boolean } | null;

/** Overall percent from bytes done across files. */
export function jobProgress(files: { size: number; done: boolean }[], currentIndex: number, currentFraction: number): number {
  const total = files.reduce((n, f) => n + f.size, 0) || 1;
  const done = files.reduce((n, f, i) => n + (f.done ? f.size : i === currentIndex ? f.size * currentFraction : 0), 0);
  return Math.min(100, Math.round((done / total) * 100));
}

const DB = "pactara-posting";
const STORE = "jobs";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "postId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch { return null; }
}

let strip: StripState = null;
const listeners = new Set<() => void>();
const set = (s: StripState) => { if (strip?.thumbUrl && strip.thumbUrl !== s?.thumbUrl) URL.revokeObjectURL(strip.thumbUrl); strip = s; listeners.forEach((l) => l()); };
export function usePostingStrip(): StripState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => strip, () => null);
}
const doneListeners = new Set<(postId: string) => void>();
export function onPostLive(fn: (postId: string) => void) { doneListeners.add(fn); return () => doneListeners.delete(fn); }

function uploadOne(file: QueueFile, token: string, onProgress: (f: number) => void): Promise<void> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/posts/${file.path.split("/").map(encodeURIComponent).join("/")}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file.blob);
  });
}

let running: string | null = null;

async function run(job: PostJob) {
  if (running === job.postId) return;
  running = job.postId;
  const thumbUrl = job.thumb ? URL.createObjectURL(job.thumb) : null;
  const sizes = job.files.map((f) => ({ size: f.blob.size, done: f.done }));
  set({ postId: job.postId, label: job.label, thumbUrl, thumbKind: job.thumbKind ?? "photo", progress: jobProgress(sizes, -1, 0), failed: false });
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("signed out");
    for (let i = 0; i < job.files.length; i++) {
      const f = job.files[i]!;
      if (f.done) continue;
      try {
        await uploadOne(f, token, (frac) => set({ ...strip!, progress: jobProgress(sizes, i, frac) }));
      } catch (e) {
        // Some networks block the direct request; the client upload has no progress but still works.
        if ((e as Error).message !== "network") throw e;
        const { error } = await supabase.storage.from("posts").upload(f.path, f.blob, { contentType: f.contentType, upsert: true });
        if (error) throw error;
      }
      f.done = true;
      sizes[i]!.done = true;
      await idb("readwrite", (s) => s.put(job));
    }
    await finalizeSocialPost({ data: { id: job.postId, ok: true } });
    await idb("readwrite", (s) => s.delete(job.postId));
    set(null);
    doneListeners.forEach((l) => l(job.postId));
  } catch (e) {
    console.error("[posting] failed", e);
    job.failed = true;
    await idb("readwrite", (s) => s.put(job));
    set({ ...(strip ?? { postId: job.postId, label: job.label, thumbUrl, thumbKind: job.thumbKind ?? "photo", progress: 0 }), failed: true });
  } finally {
    running = null;
  }
}

export async function enqueuePost(job: PostJob) {
  await idb("readwrite", (s) => s.put(job));
  void run(job);
}

export async function retryPost(postId: string) {
  const job = await idb<PostJob>("readonly", (s) => s.get(postId));
  if (job) void run({ ...job, failed: false });
  else set(null);
}

/** On launch and when the app returns to the foreground: resume unfinished uploads. */
export async function resumePendingPosts() {
  if (running) return;
  const jobs = (await idb<PostJob[]>("readonly", (s) => s.getAll())) ?? [];
  const next = jobs.find((j) => !j.failed);
  const failed = jobs.find((j) => j.failed);
  if (next) void run(next);
  else if (failed && !strip) set({ postId: failed.postId, label: failed.label, thumbUrl: failed.thumb ? URL.createObjectURL(failed.thumb) : null, thumbKind: failed.thumbKind ?? "photo", progress: 0, failed: true });
}
