import { supabase } from "@/integrations/supabase/client";
import { createSocialPost } from "./posts.functions";
import { posterAt } from "./media-picker";
import { enqueuePost, type QueueFile } from "./posting-queue";
import { skipsDiscover } from "./post-composer";
import type { PickedItem } from "./post-draft";
import type { PostAudience } from "./post-audience";
import type { PostItemInput, PostWorkoutChoice } from "./social-post-types";
import { markHomePost } from "./home-visit-posts";
import { postItemCrop } from "./post-video-layout";

const extOf = (blob: Blob, name: string, kind: "photo" | "video") => {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 4 && fromName !== name.toLowerCase()) return fromName === "jpeg" ? "jpg" : fromName;
  const sub = blob.type.split("/")[1]?.split(";")[0];
  return (sub || (kind === "video" ? "mp4" : "jpg")).replace("quicktime", "mov").replace("jpeg", "jpg");
};

/** Creates the post (hidden from others while uploading), then hands media to the background queue. */
export async function submitPost(input: {
  picked: PickedItem[]; caption: string; audience: PostAudience; workout: PostWorkoutChoice; commentsOn: boolean; tags: string[];
}): Promise<{ id: string; uploading: boolean }> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("You're signed out. Sign in and try again.");
  const stamp = Date.now();
  const files: QueueFile[] = [];
  const items: PostItemInput[] = [];
  let thumb: Blob | null = null;
  let thumbKind: "photo" | "video" = "photo";
  for (const [i, { media, edit }] of input.picked.entries()) {
    const path = `${uid}/${stamp}-${i}.${extOf(media.file, media.name, media.kind)}`;
    files.push({ path, blob: media.file, contentType: media.file.type || (media.kind === "video" ? "video/mp4" : "image/jpeg"), done: false });
    let posterPath: string | null = null;
    if (media.kind === "video") {
      const poster = await posterAt(media.file, edit.cover || edit.trimStart || 0.2);
      if (poster) {
        posterPath = `${path}.poster.jpg`;
        files.push({ path: posterPath, blob: poster, contentType: "image/jpeg", done: false });
        if (!thumb) { thumb = poster; thumbKind = "video"; }
      }
    } else thumb ??= media.file;
    items.push({
      kind: media.kind, path, posterPath, duration: media.duration,
      trimStart: media.kind === "video" ? edit.trimStart : null, trimEnd: media.kind === "video" ? edit.trimEnd : null,
      muted: edit.muted, cover: media.kind === "video" ? edit.cover : null, crop: postItemCrop(media.kind, edit.crop),
    });
  }
  const { id } = await createSocialPost({ data: {
    caption: input.caption, audience: input.audience.kind, crewIds: input.audience.crewIds, items, workout: input.workout,
    commentsOn: input.audience.kind !== "only_me" && input.commentsOn, tags: input.audience.kind === "only_me" ? [] : input.tags, skipDiscover: skipsDiscover(input.picked.map((p) => p.edit)),
  } });
  markHomePost(id);
  if (files.length) await enqueuePost({ postId: id, label: "Posting...", thumb, thumbKind, files, failed: false });
  return { id, uploading: files.length > 0 };
}
