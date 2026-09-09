import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationKind =
  | "comment"
  | "reply"
  | "comment_like"
  | "reaction"
  | "message"
  | "checkin"
  | "join";

export type NotificationItem = {
  key: string;
  kind: NotificationKind;
  actorId: string;
  actorName: string;
  actorColor: string;
  actorAvatarUrl: string | null;
  text: string;
  createdAt: string;
  read: boolean;
  mediaUrl: string | null;
  mediaKind: "image" | "video" | null;
  groupId: string;
  postId: string | null;
};

const WINDOW_DAYS = 30;

function since(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function isVideo(path: string | null) {
  if (!path) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(path);
}

async function signMany(
  supabase: SupabaseClient,
  bucket: "avatars" | "chat-photos",
  paths: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 60 * 60);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

type RawItem = Omit<
  NotificationItem,
  "actorName" | "actorColor" | "actorAvatarUrl" | "read" | "mediaUrl"
> & { mediaPath: string | null };

/** Collect raw notification rows for one group, newest first. */
async function collect(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  groupName: string,
): Promise<RawItem[]> {
  const from = since(WINDOW_DAYS);
  const items: RawItem[] = [];

  const [{ data: posts }, { data: messages }, { data: checkIns }, { data: joins }] =
    await Promise.all([
      supabase
        .from("daily_posts")
        .select("id, user_id, check_in_id")
        .eq("group_id", groupId)
        .gte("local_date", from.slice(0, 10)),
      supabase
        .from("group_messages")
        .select("id, user_id, body, image_url, created_at")
        .eq("group_id", groupId)
        .neq("user_id", userId)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("check_ins")
        .select("id, user_id, photo_url, created_at")
        .eq("group_id", groupId)
        .neq("user_id", userId)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("group_members")
        .select("user_id, joined_at")
        .eq("group_id", groupId)
        .neq("user_id", userId)
        .gte("joined_at", from)
        .order("joined_at", { ascending: false })
        .limit(30),
    ]);

  const postRows = (posts ?? []) as Array<{
    id: string;
    user_id: string;
    check_in_id: string | null;
  }>;
  const postIds = postRows.map((p) => p.id);
  const postAuthor = new Map(postRows.map((p) => [p.id, p.user_id]));

  // Photos attached to those posts' check-ins (for thumbnails).
  const checkInIds = postRows.map((p) => p.check_in_id).filter(Boolean) as string[];
  const postPhoto = new Map<string, string>();
  if (checkInIds.length > 0) {
    const { data: cis } = await supabase
      .from("check_ins")
      .select("id, photo_url")
      .in("id", checkInIds);
    const byCheckIn = new Map(
      ((cis ?? []) as Array<{ id: string; photo_url: string | null }>).map((c) => [
        c.id,
        c.photo_url,
      ]),
    );
    for (const p of postRows) {
      const url = p.check_in_id ? byCheckIn.get(p.check_in_id) : null;
      if (url) postPhoto.set(p.id, url);
    }
  }

  if (postIds.length > 0) {
    const [{ data: comments }, { data: reactions }] = await Promise.all([
      supabase
        .from("post_comments")
        .select("id, post_id, user_id, body, media_url, parent_comment_id, created_at")
        .in("post_id", postIds)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("post_reactions")
        .select("id, post_id, user_id, emoji, created_at")
        .in("post_id", postIds)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const commentRows = (comments ?? []) as Array<{
      id: string;
      post_id: string;
      user_id: string;
      body: string;
      media_url: string | null;
      parent_comment_id: string | null;
      created_at: string;
    }>;

    const myCommentIds = new Set(
      commentRows.filter((c) => c.user_id === userId).map((c) => c.id),
    );
    const myThreads = new Set(
      commentRows.filter((c) => c.user_id === userId).map((c) => c.post_id),
    );

    for (const c of commentRows) {
      if (c.user_id === userId) continue;
      const mine = postAuthor.get(c.post_id) === userId;
      const replyToMe = c.parent_comment_id ? myCommentIds.has(c.parent_comment_id) : false;
      if (!mine && !replyToMe && !myThreads.has(c.post_id)) continue;
      items.push({
        key: `comment:${c.id}`,
        kind: replyToMe ? "reply" : "comment",
        actorId: c.user_id,
        text: replyToMe
          ? "replied to your comment"
          : mine
            ? "commented on your check-in"
            : "also commented on a check-in",
        createdAt: c.created_at,
        mediaPath: c.media_url ?? postPhoto.get(c.post_id) ?? null,
        mediaKind: null,
        groupId,
        postId: c.post_id,
      });
    }

    for (const r of (reactions ?? []) as Array<{
      id: string;
      post_id: string;
      user_id: string;
      emoji: string;
      created_at: string;
    }>) {
      if (r.user_id === userId) continue;
      if (postAuthor.get(r.post_id) !== userId) continue;
      items.push({
        key: `reaction:${r.id}`,
        kind: "reaction",
        actorId: r.user_id,
        text: `reacted ${r.emoji} to your check-in`,
        createdAt: r.created_at,
        mediaPath: postPhoto.get(r.post_id) ?? null,
        mediaKind: null,
        groupId,
        postId: r.post_id,
      });
    }

    if (myCommentIds.size > 0) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("id, comment_id, user_id, created_at")
        .in("comment_id", Array.from(myCommentIds))
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(50);
      const commentPost = new Map(commentRows.map((c) => [c.id, c.post_id]));
      for (const l of (likes ?? []) as Array<{
        id: string;
        comment_id: string;
        user_id: string;
        created_at: string;
      }>) {
        if (l.user_id === userId) continue;
        const pid = commentPost.get(l.comment_id) ?? null;
        items.push({
          key: `like:${l.id}`,
          kind: "comment_like",
          actorId: l.user_id,
          text: "liked your comment",
          createdAt: l.created_at,
          mediaPath: pid ? (postPhoto.get(pid) ?? null) : null,
          mediaKind: null,
          groupId,
          postId: pid,
        });
      }
    }
  }

  for (const m of (messages ?? []) as Array<{
    id: string;
    user_id: string;
    body: string;
    image_url: string | null;
    created_at: string;
  }>) {
    const preview = (m.body ?? "").trim();
    items.push({
      key: `message:${m.id}`,
      kind: "message",
      actorId: m.user_id,
      text: preview
        ? `sent a message in ${groupName}: ${preview.slice(0, 60)}`
        : `sent a photo in ${groupName}`,
      createdAt: m.created_at,
      mediaPath: m.image_url ?? null,
      mediaKind: null,
      groupId,
      postId: null,
    });
  }

  for (const c of (checkIns ?? []) as Array<{
    id: string;
    user_id: string;
    photo_url: string | null;
    created_at: string;
  }>) {
    items.push({
      key: `checkin:${c.id}`,
      kind: "checkin",
      actorId: c.user_id,
      text: "checked in",
      createdAt: c.created_at,
      mediaPath: c.photo_url ?? null,
      mediaKind: null,
      groupId,
      postId: null,
    });
  }

  for (const j of (joins ?? []) as Array<{ user_id: string; joined_at: string }>) {
    items.push({
      key: `join:${groupId}:${j.user_id}`,
      kind: "join",
      actorId: j.user_id,
      text: `joined ${groupName}`,
      createdAt: j.joined_at,
      mediaPath: null,
      mediaKind: null,
      groupId,
      postId: null,
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, 120);
}

async function readKeys(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("notification_reads")
    .select("item_key")
    .eq("user_id", userId);
  return new Set(((data ?? []) as Array<{ item_key: string }>).map((r) => r.item_key));
}

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    if (!input || typeof input.groupId !== "string") throw new Error("groupId required");
    return { groupId: input.groupId };
  })
  .handler(async ({ data, context }): Promise<{ items: NotificationItem[] }> => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { items: [] };

    const { data: group } = await supabase
      .from("groups")
      .select("id, name")
      .eq("id", data.groupId)
      .maybeSingle();

    const raw = await collect(supabase, userId, data.groupId, group?.name ?? "your group");
    if (raw.length === 0) return { items: [] };

    const actorIds = Array.from(new Set(raw.map((r) => r.actorId)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, avatar_color, avatar_url")
      .in("id", actorIds);
    const profRows = (profs ?? []) as Array<{
      id: string;
      name: string;
      avatar_color: string;
      avatar_url: string | null;
    }>;

    const [avatarUrls, mediaUrls, read] = await Promise.all([
      signMany(
        supabase,
        "avatars",
        profRows.map((p) => p.avatar_url ?? "").filter(Boolean),
      ),
      signMany(
        supabase,
        "chat-photos",
        raw.map((r) => r.mediaPath ?? "").filter(Boolean),
      ),
      readKeys(supabase, userId),
    ]);

    const byId = new Map(profRows.map((p) => [p.id, p]));

    const items: NotificationItem[] = raw.map((r) => {
      const p = byId.get(r.actorId);
      return {
        key: r.key,
        kind: r.kind,
        actorId: r.actorId,
        actorName: (p?.name ?? "").trim() || "Someone",
        actorColor: p?.avatar_color ?? "#7C3AED",
        actorAvatarUrl: p?.avatar_url ? (avatarUrls[p.avatar_url] ?? null) : null,
        text: r.text,
        createdAt: r.createdAt,
        read: read.has(r.key),
        mediaUrl: r.mediaPath ? (mediaUrls[r.mediaPath] ?? null) : null,
        mediaKind: r.mediaPath ? (isVideo(r.mediaPath) ? "video" : "image") : null,
        groupId: r.groupId,
        postId: r.postId,
      };
    });

    return { items };
  });

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ total: number }> => {
    const { supabase, userId } = context;
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    const groupIds = ((memberships ?? []) as Array<{ group_id: string }>).map(
      (m) => m.group_id,
    );
    if (groupIds.length === 0) return { total: 0 };

    const { data: groups } = await supabase
      .from("groups")
      .select("id, name")
      .in("id", groupIds);
    const nameById = new Map(
      ((groups ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]),
    );

    const read = await readKeys(supabase, userId);
    const lists = await Promise.all(
      groupIds.map((id) => collect(supabase, userId, id, nameById.get(id) ?? "your group")),
    );
    let total = 0;
    for (const list of lists) {
      for (const item of list) if (!read.has(item.key)) total += 1;
    }
    return { total };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { keys: string[] }) => {
    if (!input || !Array.isArray(input.keys)) throw new Error("keys required");
    return { keys: input.keys.filter((k) => typeof k === "string").slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.keys.length === 0) return { ok: true };
    const rows = data.keys.map((k) => ({ user_id: userId, item_key: k }));
    const { error } = await supabase
      .from("notification_reads")
      .upsert(rows, { onConflict: "user_id,item_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
