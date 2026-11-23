/**
 * Photo check-ins: the same Story (9:16) / Post (1:1) center crop as the
 * video render, with the card painted on top, as a JPEG. Browser-only.
 */
import { outputSize, type ShareFormat } from "@/lib/share-card";

export async function loadPhoto(source: Blob): Promise<ImageBitmap> {
  return createImageBitmap(source);
}

export async function renderShareImage(opts: {
  photo: ImageBitmap;
  format: ShareFormat;
  overlay: ((width: number, height: number) => HTMLCanvasElement | null) | null;
}): Promise<Blob> {
  const { photo } = opts;
  const out = outputSize(opts.format, Math.min(photo.width, photo.height));
  const c = document.createElement("canvas");
  c.width = out.width;
  c.height = out.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#141218";
  ctx.fillRect(0, 0, out.width, out.height);
  // object-fit: cover, centered.
  const scale = Math.max(out.width / photo.width, out.height / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, (out.width - w) / 2, (out.height - h) / 2, w, h);
  const layer = opts.overlay?.(out.width, out.height);
  if (layer) ctx.drawImage(layer, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("couldn't encode image");
  return blob;
}
