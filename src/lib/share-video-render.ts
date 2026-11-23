/**
 * Renders the share video on the phone (no upload): center-crops the check-in
 * clip to Story (9:16) or Post (1:1), burns the card overlay into every frame
 * and writes an H.264 MP4 that Instagram, Messages and Photos all accept.
 * Uses WebCodecs (iOS 16.4+) through mediabunny. Browser-only.
 */
import type { ShareFormat } from "@/lib/share-card";
import { outputSize } from "@/lib/share-card";

export type RenderResult = { blob: Blob; width: number; height: number; ms: number };

type Mb = typeof import("mediabunny");
let mbPromise: Promise<Mb> | null = null;
const loadMb = () => (mbPromise ??= import("mediabunny"));

/** True when this device can encode H.264 on the phone. */
export async function canRenderOnDevice(): Promise<boolean> {
  if (typeof window === "undefined" || typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
    return false;
  }
  try {
    const mb = await loadMb();
    return await mb.canEncodeVideo("avc", { width: 1080, height: 1920, bitrate: 8e6 });
  } catch {
    return false;
  }
}

/** The clip's display size and length (rotation applied). */
export async function probeClip(source: Blob): Promise<{ width: number; height: number; duration: number } | null> {
  try {
    const mb = await loadMb();
    const input = new mb.Input({ source: new mb.BlobSource(source), formats: mb.ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const [width, height, duration] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      input.computeDuration(),
    ]);
    input.dispose?.();
    return { width, height, duration };
  } catch {
    return null;
  }
}

export async function renderShareVideo(opts: {
  source: Blob;
  format: ShareFormat;
  /** Paints the overlay for this output size (transparent where the video shows). */
  overlay: (width: number, height: number) => HTMLCanvasElement | null;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}): Promise<RenderResult> {
  const started = performance.now();
  const mb = await loadMb();
  const input = new mb.Input({ source: new mb.BlobSource(opts.source), formats: mb.ALL_FORMATS });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error("no video track");
  const srcW = await videoTrack.getDisplayWidth();
  const srcH = await videoTrack.getDisplayHeight();
  const { width, height } = outputSize(opts.format, Math.min(srcW, srcH));

  const overlay = opts.overlay(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  // Keep the sound when it can be copied as-is (iPhone clips are AAC);
  // otherwise try AAC, and if the phone can't, render without sound.
  const audioTrack = await input.getPrimaryAudioTrack();
  type AudioOpt = { discard: true } | { codec: "aac" } | undefined;
  const attempts: AudioOpt[] = !audioTrack ? [undefined] : [{ codec: "aac" }, { discard: true }];

  let output: InstanceType<Mb["Output"]> | null = null;
  let lastError: unknown = null;
  for (const audio of attempts) {
    if (opts.signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const out = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    try {
      const conversion = await mb.Conversion.init({
        input,
        output: out,
        video: {
          width,
          height,
          fit: "cover",
          codec: "avc",
          bitrate: width >= 1080 ? (opts.format === "story" ? 8e6 : 6e6) : 4.5e6,
          forceTranscode: true,
          process: (sample) => {
            ctx.clearRect(0, 0, width, height);
            sample.draw(ctx, 0, 0, width, height);
            if (overlay) ctx.drawImage(overlay, 0, 0);
            return canvas;
          },
          processedWidth: width,
          processedHeight: height,
        },
        audio,
        showWarnings: false,
      });
      if (!conversion.isValid) {
        throw new Error(`can't convert: ${conversion.discardedTracks.map((t) => t.reason).join(", ")}`);
      }
      if (opts.onProgress) conversion.onProgress = (p) => opts.onProgress?.(p);
      const onAbort = () => void conversion.cancel();
      opts.signal?.addEventListener("abort", onAbort);
      try {
        await conversion.execute();
      } finally {
        opts.signal?.removeEventListener("abort", onAbort);
      }
      output = out;
      break;
    } catch (e) {
      if (opts.signal?.aborted) throw new DOMException("cancelled", "AbortError");
      lastError = e;
      console.warn("[share] render attempt failed", audio, e);
    }
  }
  if (!output) throw lastError ?? new Error("render failed");
  const buffer = (output.target as InstanceType<Mb["BufferTarget"]>).buffer;
  if (!buffer) throw new Error("empty render");
  return { blob: new Blob([buffer], { type: "video/mp4" }), width, height, ms: Math.round(performance.now() - started) };
}
