import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { homePage, type HomeEntry, type HomeRef } from "./home-feed";
import { signAvatarThumbs } from "./media-urls";
import { stabilizeSignedUrls } from "./stable-urls";
const pageInput = z.object({
  tab: z.enum(["following", "for-you"]),
  before: z
    .object({ at: z.string().datetime({ offset: true }), key: z.string().max(80) })
    .nullable()
    .optional(),
});
export const getNewHomeFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pageInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const { loadSocialPostsForViewer } = await import("./social-post-load.server");
    const { data: rawRefs, error } = await supabase.rpc("get_new_home_refs", {
      _tab: data.tab,
      _before: data.before ?? null,
    });
    if (error) throw new Error("Could not load Home");
    const { page, next } = homePage((rawRefs ?? []) as HomeRef[]);
    const postIds = page.filter((r) => r.kind === "post").map((r) => r.id);
    const { loadHomeCheckIns } = await import("./home-checkin-view.server");
    const [posts, checks] = await Promise.all([
      postIds.length
        ? supabase
            .from("social_posts")
            .select("*")
            .in("id", postIds)
            .then(({ data: rows, error }) => {
              if (error) throw new Error("Could not load Home");
              return loadSocialPostsForViewer(
                supabase,
                context.userId,
                (rows ?? []) as Record<string, unknown>[],
              );
            })
        : [],
      loadHomeCheckIns(
        supabase,
        context.userId,
        page.filter((r) => r.kind === "checkin"),
      ),
    ]);
    const postById = new Map(posts.map((p) => [p.id, p]));
    const checkByKey = new Map(checks.map((c) => [c.key, c]));
    const entries: HomeEntry[] = page.flatMap((ref): HomeEntry[] => {
      if (ref.kind === "post") {
        const post = postById.get(ref.id);
        return post ? [{ kind: "post", key: ref.key, post }] : [];
      }
      const check = checkByKey.get(ref.key);
      return check ? [check] : [];
    });
    return stabilizeSignedUrls({ entries, next });
  });
export const getNewHomeSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_new_home_suggestions");
    if (error) throw new Error("Could not load suggestions");
    const people = (data ?? []) as {
      id: string;
      name: string | null;
      avatar_url: string | null;
      avatar_color: string | null;
    }[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avatars = await signAvatarThumbs(
      supabaseAdmin,
      people.map((p) => p.avatar_url),
    );
    return people.map((p) => ({
      id: p.id,
      name: p.name?.trim() || "Member",
      avatarUrl: p.avatar_url
        ? p.avatar_url.startsWith("http")
          ? p.avatar_url
          : (avatars.get(p.avatar_url) ?? null)
        : null,
      avatarColor: p.avatar_color ?? "#7C3AED",
    }));
  });

export const getHomeFollowState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ target: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: profile, error } = await context.supabase.rpc("get_profile", {
      target: data.target,
    });
    if (error) throw new Error("Could not load follow state");
    const p = profile as { relationship?: string; can_follow?: boolean } | null;
    return { relationship: p?.relationship ?? "none", canFollow: p?.can_follow === true };
  });

export const getNewHomeCheckIn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadHomeCheckIns } = await import("./home-checkin-view.server");
    const entries = await loadHomeCheckIns(
      context.supabase as unknown as SupabaseClient,
      context.userId,
      [
        {
          kind: "checkin",
          id: data.id,
          key: `checkin:${data.id}`,
          created_at: "",
          group_id: null,
          crew_name: null,
        },
      ],
    );
    return stabilizeSignedUrls(entries[0] ?? null);
  });
