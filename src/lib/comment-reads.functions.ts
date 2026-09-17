import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const key = (postId: string) => `post-comments:${postId}`;

/**
 * Unread comment counts per post, derived from server-side read state so the
 * badge survives a reinstall / new device (local storage does not).
 */
export const getUnreadCommentCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: reads }, { data: comments }] = await Promise.all([
      supabase
        .from("notification_reads")
        .select("item_key, read_at")
        .eq("user_id", userId)
        .like("item_key", "post-comments:%"),
      supabase
        .from("post_comments")
        .select("post_id, user_id, created_at")
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3000),
    ]);

    const readAt = new Map<string, number>();
    for (const r of (reads ?? []) as Array<{ item_key: string; read_at: string }>) {
      readAt.set(r.item_key.slice("post-comments:".length), new Date(r.read_at).getTime());
    }

    const counts: Record<string, number> = {};
    for (const c of (comments ?? []) as Array<{
      post_id: string;
      user_id: string;
      created_at: string;
    }>) {
      if (c.user_id === userId) continue;
      const seen = readAt.get(c.post_id);
      if (seen !== undefined && new Date(c.created_at).getTime() <= seen) continue;
      counts[c.post_id] = (counts[c.post_id] ?? 0) + 1;
    }

    return counts;
  });

export const markPostCommentsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string }) => {
    if (!input || typeof input.postId !== "string") throw new Error("postId required");
    return { postId: input.postId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notification_reads").upsert(
      { user_id: userId, item_key: key(data.postId), read_at: new Date().toISOString() },
      { onConflict: "user_id,item_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
