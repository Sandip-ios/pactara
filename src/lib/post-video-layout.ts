/** Library videos keep every pixel; extreme shapes get bars, never a crop. */
import type { DraftCrop } from "./post-composer";

export function postItemCrop(kind: "photo" | "video", crop: DraftCrop): DraftCrop | null {
  return kind === "video" ? null : crop;
}

export function postVideoRatio(width: number, height: number): number {
  if (!(width > 0 && height > 0)) return 9 / 16;
  return Math.max(9 / 16, Math.min(1.91, width / height));
}

export function trimFrameTime(duration: number, index: number, count = 10): number {
  return Math.min(Math.max(0.1, duration * index / count), Math.max(0.01, duration - 0.01));
}

/** One decoder, explicit non-zero seeks, and decoded JPEGs instead of iOS fragment previews. */
export async function trimFrames(url: string, duration: number, signal: AbortSignal): Promise<string[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const wait = (event: "loadeddata" | "seeked", action: () => void) => new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", fail);
      signal.removeEventListener("abort", fail);
    };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Video frame unavailable")); };
    const timer = window.setTimeout(fail, 15000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", fail, { once: true });
    signal.addEventListener("abort", fail, { once: true });
    if (signal.aborted) fail(); else action();
  });
  try {
    await wait("loadeddata", () => { video.src = url; video.load(); });
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = Math.max(1, Math.round(120 * video.videoHeight / video.videoWidth));
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const frames: string[] = [];
    for (let i = 0; i < 10; i++) {
      if (signal.aborted) return [];
      await wait("seeked", () => { video.currentTime = trimFrameTime(duration || video.duration, i); });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}