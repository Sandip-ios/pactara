import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeEntry, HomeRef } from "./home-feed";
import type { CheckInNode } from "./feed-days";
import type { FeedItem } from "./daily-posts.functions";
import { signAvatarThumbs, signFeedMedia, signVideoPosters } from "./media-urls";
type Row = {
  id: string;
  userId: string;
  groupId: string;
  localDate: string;
  createdAt: string;
  note: string | null;
  activity: string | null;
  mood: string | null;
  photoUrl: string | null;
  health: CheckInNode["health"];
  name: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  postId: string | null;
  workout: CheckInNode["workout"];
};
export async function loadHomeCheckIns(
  db: SupabaseClient,
  userId: string,
  refs: HomeRef[],
): Promise<HomeEntry[]> {
  if (!refs.length) return [];
  const { data, error } = await db.rpc("get_new_home_checkins", { _ids: refs.map((r) => r.id) });
  if (error) throw new Error("Check-in unavailable");
  const rows = (data ?? []) as Row[];
  // The RPC has rechecked every ID's visibility. Only its safe media paths may be signed with the privileged client.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [avatars, media, posters] = await Promise.all([
    signAvatarThumbs(
      supabaseAdmin,
      rows.map((r) => r.avatarUrl),
    ),
    signFeedMedia(
      supabaseAdmin,
      rows.map((r) => r.photoUrl),
    ),
    signVideoPosters(
      supabaseAdmin,
      rows.map((r) => r.photoUrl),
    ),
  ]);
  const byId = new Map(rows.map((c) => [c.id, c]));
  return refs.flatMap((ref): HomeEntry[] => {
    const c = byId.get(ref.id);
    if (!c) return [];
    const checkIn: CheckInNode = {
      kind: "check_in",
      id: `c-${c.id}`,
      mood: c.mood,
      activity: c.activity,
      workout: c.workout,
      health: c.health,
      note: c.note,
      isCounted: true,
      social: { reactors: [], commentCount: 0 },
      photoUrl: c.photoUrl
        ? c.photoUrl.startsWith("http")
          ? c.photoUrl
          : (media.get(c.photoUrl) ?? null)
        : null,
      posterUrl: c.photoUrl ? (posters.get(c.photoUrl) ?? null) : null,
      at: c.createdAt,
    };
    const item: FeedItem = {
      id: c.postId ?? c.id,
      groupId: c.groupId,
      userId: c.userId,
      isMe: c.userId === userId,
      name: c.name || "Member",
      avatarColor: c.avatarColor || "#7C3AED",
      avatarUrl: c.avatarUrl
        ? c.avatarUrl.startsWith("http")
          ? c.avatarUrl
          : (avatars.get(c.avatarUrl) ?? null)
        : null,
      localDate: c.localDate,
      updatedAt: c.createdAt,
      nodes: [checkIn],
      reactions: [],
      reactors: [],
      commentCount: 0,
      lastCommentAt: null,
      latestComment: null,
      dayNumber: 0,
      weekCount: 0,
    };
    return [
      {
        kind: "checkin",
        key: ref.key,
        item,
        checkIn,
        crewName: ref.crew_name,
        canInteract: !!c.postId,
      },
    ];
  });
}
