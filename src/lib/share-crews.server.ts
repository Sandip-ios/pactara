import type { SupabaseClient } from "@supabase/supabase-js";
import { orderCrewsForShare, type ShareCrew } from "@/lib/workout-share";

/**
 * The crews a member can send something to from a Share panel, most recent
 * chat first, with up to three teammates' photos each. Runs as the member
 * (RLS applies).
 */
export async function loadShareCrews(supabase: SupabaseClient, userId: string): Promise<ShareCrew[]> {
  const { data: mine } = await supabase.from("group_members").select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null).eq("user_id", userId);
  const groupIds = (mine ?? []).map((m) => m.group_id as string);
  if (!groupIds.length) return [];
  const [{ data: groups }, { data: members }, lastRows] = await Promise.all([
    supabase.from("groups").select("id, name, emoji").is("ended_at", null).in("id", groupIds),
    supabase.from("group_members").select("group_id, user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null).in("group_id", groupIds).order("joined_at", { ascending: true }),
    Promise.all(
      groupIds.map(async (gid) => {
        const { data: m } = await supabase
          .from("group_messages")
          .select("created_at")
          .eq("group_id", gid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return [gid, (m?.created_at as string | undefined) ?? null] as const;
      }),
    ),
  ]);
  const otherIds = [...new Set((members ?? []).map((m) => m.user_id as string).filter((id) => id !== userId))];
  const { data: profs } = otherIds.length
    ? await supabase.from("profiles").select("id, name, avatar_color, avatar_url").in("id", otherIds)
    : { data: [] as { id: string; name: string; avatar_color: string; avatar_url: string | null }[] };
  const paths = (profs ?? []).map((p) => p.avatar_url as string | null).filter((x): x is string => !!x && !x.startsWith("http"));
  const { signAvatarThumbs } = await import("@/lib/media-urls");
  const signed = paths.length ? await signAvatarThumbs(supabase, paths, 96) : new Map<string, string>();
  const profile = new Map(
    (profs ?? []).map((p) => {
      const path = (p.avatar_url as string | null) ?? null;
      return [
        p.id as string,
        {
          id: p.id as string,
          name: ((p.name as string) ?? "").trim() || "Member",
          avatarColor: (p.avatar_color as string) ?? "#7C3AED",
          avatarUrl: path ? (path.startsWith("http") ? path : (signed.get(path) ?? null)) : null,
        },
      ];
    }),
  );
  const last = new Map(lastRows);
  const joined = new Map((mine ?? []).map((m) => [m.group_id as string, m.joined_at as string]));
  const rows = (groups ?? []).map((g) => {
    const inGroup = (members ?? []).filter((m) => m.group_id === g.id);
    const others = inGroup.filter((m) => m.user_id !== userId).flatMap((m) => profile.get(m.user_id as string) ?? []);
    return {
      id: g.id as string,
      name: g.name as string,
      emoji: g.emoji as string,
      memberCount: inGroup.length,
      others: others.slice(0, 3),
      othersCount: others.length,
      lastMessageAt: last.get(g.id as string) ?? null,
      joinedAt: joined.get(g.id as string) ?? "",
    };
  });
  return orderCrewsForShare(rows).map(({ othersCount: _o, lastMessageAt: _l, joinedAt: _j, ...c }) => c);
}
