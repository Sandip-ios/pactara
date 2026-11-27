import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { removeMeFromSocialPost } from "@/lib/posts.functions";
import { canRemoveMe, removeMe } from "@/lib/post-tags";
import type { SocialPostView } from "@/lib/social-post-types";
import { newToastApi } from "../new-toast";

/** 73h: no confirm; the viewer's tag comes off right away and the author isn't told. */
export function useRemoveMe<T extends SocialPostView | null>(post: T) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const viewerId = user?.id ?? null;
  const qc = useQueryClient();
  const fn = useServerFn(removeMeFromSocialPost);
  const [removed, setRemoved] = useState(false);
  const shown = (post && removed && viewerId ? { ...post, tagged: removeMe(post.tagged, viewerId) } : post) as T;
  const canRemove = !!post && !!viewerId && canRemoveMe({ authorId: post.author.id, taggedIds: shown?.tagged.map((t) => t.id) ?? [] }, viewerId);
  const run = () => {
    if (!post) return;
    setRemoved(true);
    void fn({ data: { id: post.id } }).then(() => {
      newToastApi.success("You're no longer tagged in this post");
      for (const key of ["home-social-posts", "social-post", "crew-social-posts", "new-activity", "home-feed"]) void qc.invalidateQueries({ queryKey: [key] });
    }).catch(() => { setRemoved(false); newToastApi.error("Couldn't remove your tag. Try again."); });
  };
  return { post: shown, viewerId, canRemove, run };
}
