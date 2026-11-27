import { Capacitor } from "@capacitor/core";

/**
 * Library picker: the native photo picker in the iOS app when the build has the
 * plugin, otherwise null so the caller opens its file input (web and older builds).
 */
export async function pickFromNativeLibrary(limit: number): Promise<{ blob: Blob; name: string }[] | null> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("FilePicker")) return null;
  const { FilePicker } = await import("@capawesome/capacitor-file-picker");
  try {
    const res = await FilePicker.pickMedia({ limit, ordered: true, skipTranscoding: false });
    const out: { blob: Blob; name: string }[] = [];
    for (const f of res.files) {
      if (f.blob) { out.push({ blob: f.blob, name: f.name }); continue; }
      const src = f.webPath ?? (f.path ? Capacitor.convertFileSrc(f.path) : null);
      if (!src) continue;
      const blob = await (await fetch(src)).blob();
      out.push({ blob: blob.type ? blob : new Blob([blob], { type: f.mimeType }), name: f.name });
    }
    return out;
  } catch (e) {
    // Cancelled: nothing picked.
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return [];
    throw e;
  }
}

/** Grab a JPEG frame at `time` seconds (the chosen cover). */
export async function posterAt(blob: Blob, time: number, maxWidth = 720): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error("timeout")), 5000);
      video.addEventListener("loadeddata", () => { window.clearTimeout(t); resolve(); }, { once: true });
      video.addEventListener("error", () => { window.clearTimeout(t); reject(new Error("load")); }, { once: true });
    });
    await new Promise<void>((resolve) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
      window.setTimeout(resolve, 1000);
      try { video.currentTime = Math.max(0.1, time); } catch { resolve(); }
    });
    const w = Math.min(maxWidth, video.videoWidth || maxWidth);
    const h = Math.round((w / (video.videoWidth || w)) * (video.videoHeight || w));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
