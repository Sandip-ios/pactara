import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage URL signing for feed/profile media.
 *
 * Original uploads are large (phone photos up to ~12 MB, avatars included),
 * so images are signed through the storage image transformer at the size they
 * are displayed. Videos can't be transformed, so they are batch-signed as-is.
 */
const TTL = 60 * 60;
const VIDEO_RE = /\.(mp4|mov|webm|m4v|ogg)$/i;

export const isVideoPath = (path: string) => VIDEO_RE.test(path);

async function signImages(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
  width: number,
  height?: number,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    paths.map(async (path) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, TTL, {
        transform: height
          ? { width, height, resize: "cover", quality: 75 }
          : { width, resize: "contain", quality: 75 },
      });
      if (data?.signedUrl) out.set(path, data.signedUrl);
    }),
  );
  return out;
}

/** Small square avatar thumbnails (default 192px — enough for 3x screens at 64px). */
export async function signAvatarThumbs(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[],
  size = 192,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p && !p.startsWith("http"))));
  return signImages(supabase, "avatars", unique, size, size);
}

/** Check-in / comment media: images resized for phone screens, videos signed in one batch. */
export async function signFeedMedia(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[],
  bucket = "chat-photos",
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p && !p.startsWith("http"))));
  const videos = unique.filter(isVideoPath);
  const images = unique.filter((p) => !isVideoPath(p));
  const [imageMap, videoRes] = await Promise.all([
    signImages(supabase, bucket, images, 1080),
    videos.length
      ? supabase.storage.from(bucket).createSignedUrls(videos, TTL)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  for (const v of videoRes.data ?? []) {
    if (v.path && v.signedUrl) imageMap.set(v.path, v.signedUrl);
  }
  return imageMap;
}
