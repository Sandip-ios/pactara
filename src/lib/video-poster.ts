/** Grab a JPEG frame from a video blob so the feed can show it before the video loads. */
export async function makeVideoPoster(blob: Blob, maxWidth = 720): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("poster timeout")), 4000);
      video.addEventListener("loadeddata", () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
      video.addEventListener("error", () => {
        window.clearTimeout(timer);
        reject(new Error("poster load failed"));
      }, { once: true });
    });
    // Step slightly in so we don't capture a black first frame.
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener("seeked", done, { once: true });
      window.setTimeout(done, 800);
      try {
        video.currentTime = 0.2;
      } catch {
        done();
      }
    });
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, maxWidth / w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
