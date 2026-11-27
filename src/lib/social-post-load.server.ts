import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPostView, PostWorkout } from "./social-post-types";
import type { AudienceKind } from "./post-audience";
import { signAvatarThumbs, signFeedMedia } from "./media-urls";
const BUCKET = "posts";
type Row = Record<string, unknown>;

export async function loadSocialPostsForViewer(
  supabase: SupabaseClient,
  userId: string,
  rows: Row[],
): Promise<SocialPostView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r["id"] as string);
  const authorIds = [...new Set(rows.map((r) => r["user_id"] as string))];
  const [
    { data: items },
    { data: crews },
    { data: cheers },
    { data: comments },
    { data: saves },
    { data: authors },
    { data: memberRows },
    { data: tagRows },
  ] = await Promise.all([
    supabase.from("social_post_items").select("*").in("post_id", ids).order("position"),
    supabase.from("social_post_crews").select("post_id, group_id").in("post_id", ids),
    supabase.from("social_post_cheers").select("post_id, user_id").in("post_id", ids),
    supabase.from("social_post_comments").select("post_id").in("post_id", ids),
    supabase.from("social_post_saves").select("post_id, user_id").in("post_id", ids),
    supabase
      .from("profiles")
      .select("id, name, avatar_url, avatar_color")
      .in("id", authorIds)
      .then(async ({ data }) => {
        const found = new Set(((data ?? []) as Row[]).map((p) => p["id"] as string));
        const extra = await Promise.all(
          authorIds
            .filter((id) => !found.has(id))
            .map(async (id) => {
              const { data: p } = await supabase.rpc("get_profile", { target: id });
              const profile = p as Row | null;
              return profile
                ? {
                    id,
                    name: profile["name"],
                    avatar_url: profile["avatar"],
                    avatar_color: "#7C3AED",
                  }
                : null;
            }),
        );
        return { data: [...((data ?? []) as Row[]), ...extra.filter(Boolean)] as Row[] };
      }),
    supabase.from("group_members").select("group_id, groups!inner(name)").eq("user_id", userId),
    supabase.from("social_post_tags").select("post_id, user_id, created_at").in("post_id", ids).order("created_at"),
  ]);
  const tagUserIds = [...new Set(((tagRows ?? []) as Row[]).map((t) => t["user_id"] as string))];
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { blockedPairs } = await import("./safety.server");
  const [{ data: tagProfiles }, blocked] = tagUserIds.length
    ? await Promise.all([admin.from("profiles").select("id, name, username, avatar_url, avatar_color").in("id", tagUserIds), blockedPairs(admin, userId)])
    : [{ data: [] as Row[] }, new Set<string>()];
  const tagAvatars = await signAvatarThumbs(admin, ((tagProfiles ?? []) as Row[]).map((p) => p["avatar_url"] as string | null));
  const tagProfile = new Map(((tagProfiles ?? []) as Row[]).map((p) => [p["id"] as string, p]));
  const paths = ((items ?? []) as Row[]).flatMap((i) =>
    [i["path"] as string, i["poster_path"] as string | null].filter((p): p is string => !!p),
  );
  const signed = await signFeedMedia(supabase, paths, BUCKET);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const avatars = await signAvatarThumbs(
    supabaseAdmin,
    ((authors ?? []) as Row[]).map((a) => a["avatar_url"] as string | null),
  );
  const myCrewNames = new Map(
    ((memberRows ?? []) as unknown as { group_id: string; groups: { name: string } }[]).map((m) => [
      m.group_id,
      m.groups.name,
    ]),
  );
  const authorById = new Map(((authors ?? []) as Row[]).map((a) => [a["id"] as string, a]));
  return rows.map((r) => {
    const id = r["id"] as string;
    const mine = r["user_id"] === userId;
    const a = authorById.get(r["user_id"] as string);
    const av = (a?.["avatar_url"] as string | null) ?? null;
    let workout = (r["workout"] ?? null) as PostWorkout | null;
    if (workout && !mine)
      workout = {
        ...workout,
        prCount: 0,
        moves: workout.moves.map((m) => ({
          ...m,
          sets: m.sets.map((s) => ({ ...s, isPr: false })),
        })),
      };
    return {
      id,
      author: {
        id: r["user_id"] as string,
        name: (a?.["name"] as string) || "Member",
        avatarUrl: av ? (av.startsWith("http") ? av : (avatars.get(av) ?? null)) : null,
        avatarColor: (a?.["avatar_color"] as string | null) ?? "#7C3AED",
      },
      isMine: mine,
      caption: (r["caption"] as string) ?? "",
      createdAt: r["created_at"] as string,
      status: r["status"] as SocialPostView["status"],
      audience: r["audience"] as AudienceKind,
      crewIds: ((crews ?? []) as Row[])
        .filter((c) => c["post_id"] === id)
        .map((c) => c["group_id"] as string),
      viewerCrews: ((crews ?? []) as Row[])
        .filter((c) => c["post_id"] === id && myCrewNames.has(c["group_id"] as string))
        .map((c) => ({
          id: c["group_id"] as string,
          name: myCrewNames.get(c["group_id"] as string) ?? "Crew",
        })),
      commentsOn: r["comments_on"] !== false,
      items: ((items ?? []) as Row[])
        .filter((i) => i["post_id"] === id)
        .map((i) => ({
          id: i["id"] as string,
          kind: i["kind"] as "photo" | "video",
          url: signed.get(i["path"] as string) ?? null,
          posterUrl: i["poster_path"] ? (signed.get(i["poster_path"] as string) ?? null) : null,
          trimStart: i["trim_start"] == null ? null : Number(i["trim_start"]),
          trimEnd: i["trim_end"] == null ? null : Number(i["trim_end"]),
          muted: !!i["muted"],
          crop: (i["crop"] ?? null) as SocialPostView["items"][number]["crop"],
        })),
      workout,
      meal: (r["meal"] ?? null) as SocialPostView["meal"],
      workoutId: (r["workout_id"] as string | null) ?? null,
      workoutSessionId: (r["workout_session_id"] as string | null) ?? null,
      pinnedAt: (r["pinned_at"] as string | null) ?? null,
      cheers: ((cheers ?? []) as Row[]).filter((c) => c["post_id"] === id).length,
      cheeredByMe: ((cheers ?? []) as Row[]).some(
        (c) => c["post_id"] === id && c["user_id"] === userId,
      ),
      comments: ((comments ?? []) as Row[]).filter((c) => c["post_id"] === id).length,
      saves: ((saves ?? []) as Row[]).filter((c) => c["post_id"] === id).length,
      savedByMe: ((saves ?? []) as Row[]).some(
        (c) => c["post_id"] === id && c["user_id"] === userId,
      ),
      tagged: ((tagRows ?? []) as Row[])
        .filter((t) => t["post_id"] === id && !blocked.has(t["user_id"] as string) && tagProfile.has(t["user_id"] as string))
        .map((t) => {
          const p = tagProfile.get(t["user_id"] as string)!;
          const av = (p["avatar_url"] as string | null) ?? null;
          return {
            id: p["id"] as string,
            name: ((p["name"] as string | null) ?? "").trim() || (p["username"] as string | null) || "Member",
            username: (p["username"] as string | null) ?? null,
            avatarUrl: av ? (av.startsWith("http") ? av : (tagAvatars.get(av) ?? null)) : null,
            avatarColor: (p["avatar_color"] as string | null) ?? "#7C3AED",
          };
        }),
    };
  });
}
