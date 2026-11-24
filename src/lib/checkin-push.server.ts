import type { SupabaseClient } from "@supabase/supabase-js";
import { isVideoPath, posterPathFor } from "./media-urls";

/** Push links must outlive a phone that was off for a while. */
const PUSH_URL_TTL = 24 * 60 * 60;
const THUMB_PX = 300;
const AVATAR_PX = 192;

async function signTransformed(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  size: number,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, PUSH_URL_TTL, {
    transform: { width: size, height: size, resize: "cover", quality: 75, format: "origin" },
  });
  return error ? null : data?.signedUrl ?? null;
}

/**
 * Sender photo and check-in thumbnail for the rich check-in push, signed for 24h
 * with the checking-in member's own client (so storage rules still apply).
 * Videos use their `<path>.poster.jpg` frame; no media (or no poster) gives null.
 */
export async function checkInPushMedia(
  supabase: SupabaseClient,
  userId: string,
  mediaPath: string | null,
): Promise<{ avatarUrl: string | null; imageUrl: string | null }> {
  const [avatarUrl, imageUrl] = await Promise.all([
    (async () => {
      try {
        const { data } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
        const path = (data?.avatar_url as string | null) ?? null;
        if (!path) return null;
        if (/^https:\/\//i.test(path)) return path;
        return await signTransformed(supabase, "avatars", path, AVATAR_PX);
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        if (!mediaPath || mediaPath.startsWith("http")) return null;
        const path = isVideoPath(mediaPath) ? posterPathFor(mediaPath) : mediaPath;
        return await signTransformed(supabase, "chat-photos", path, THUMB_PX);
      } catch {
        return null;
      }
    })(),
  ]);
  return { avatarUrl, imageUrl };
}
