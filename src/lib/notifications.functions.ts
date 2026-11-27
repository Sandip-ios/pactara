import { createServerFn } from "@tanstack/react-start";
import { commentMediaKind, mediaOnlyCommentLine } from "@/lib/comment-media";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationKind =
  | "comment"
  | "reply"
  | "comment_like"
  | "reaction"
  | "message"
  | "checkin"
  | "join"
  | "pact_signed"
  | "pact_complete";

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
  groupName: string;
  postId: string | null;
  /** Exact comment for the new-version Activity deep link; classic ignores it. */
  commentId: string | null;
  /** New version only: the check-in a cheer or reply belongs to (falls back to the day's first). */
  checkInId?: string | null;
};

/**
 * Which check-in a cheer or reply row points at, and its thumbnail path.
 * Classic always uses the day post's first check-in photo and no check-in id.
 */
export function notificationTarget(input: {
  perCheckIn: boolean;
  checkInId: string | null;
  firstCheckInId: string | null;
  scopedPhoto: Map<string, string | null>;
  postPhoto: string | null;
}): { checkInId: string | null; mediaPath: string | null } {
  if (!input.perCheckIn) return { checkInId: null, mediaPath: input.postPhoto };
  if (input.checkInId && input.scopedPhoto.has(input.checkInId)) {
    return { checkInId: input.checkInId, mediaPath: input.scopedPhoto.get(input.checkInId) ?? null };
  }
  return { checkInId: input.firstCheckInId, mediaPath: input.postPhoto };
}

/** Activity previews the replied-to check-in, never the reply's own attachment. */
export function commentNotificationTarget(input: Parameters<typeof notificationTarget>[0] & { commentMedia: string | null }) {
  const target = notificationTarget(input);
  return { ...target, mediaPath: input.perCheckIn ? target.mediaPath : input.commentMedia ?? target.mediaPath };
}

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
  "actorName" | "actorColor" | "actorAvatarUrl" | "read" | "mediaUrl" | "groupName" | "commentId"
> & { mediaPath: string | null; commentId?: string | null; checkInId?: string | null };

/** Collect raw notification rows for one group, newest first. */
async function collect(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  groupName: string,
  perCheckIn = false,
): Promise<RawItem[]> {
  const { blockedPairs } = await import('./safety.server');
  const blocked = await blockedPairs(supabase, userId);
  const from = since(WINDOW_DAYS);
  const items: RawItem[] = [];

  const [{ data: posts }, { data: messages }, { data: checkIns }, { data: joins }] =
    await Promise.all([
      supabase
        .from("daily_posts")
        .select("id, user_id, local_date, check_in_id")
        .eq("group_id", groupId)
        .gte("local_date", from.slice(0, 10)),
      supabase
        .from("group_messages")
        .select("id, user_id, body, image_url, created_at, shared_workout_code, shared_plan_slug")
        .eq("group_id", groupId)
        .neq("user_id", userId)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("check_ins")
        .select("id, user_id, checkin_date, photo_url, created_at")
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
    local_date: string;
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
        .select("id, post_id, check_in_id, user_id, body, media_url, media_type, parent_comment_id, created_at")
        .in("post_id", postIds)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("post_reactions")
        .select("id, post_id, check_in_id, user_id, emoji, created_at")
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
      media_type: string | null;
      parent_comment_id: string | null;
      created_at: string;
      check_in_id: string | null;
    }>;
    const reactionRows = (reactions ?? []) as Array<{
      id: string;
      post_id: string;
      check_in_id: string | null;
      user_id: string;
      emoji: string;
      created_at: string;
    }>;
    // New version: a cheer or reply on a later check-in shows that check-in's photo.
    const scopedPhoto = new Map<string, string | null>();
    if (perCheckIn) {
      const ids = Array.from(new Set([...commentRows, ...reactionRows].map((r) => r.check_in_id).filter((id): id is string => !!id)));
      if (ids.length) {
        const { data: cis } = await supabase.from("check_ins").select("id, photo_url").in("id", ids);
        for (const c of (cis ?? []) as { id: string; photo_url: string | null }[]) scopedPhoto.set(c.id, c.photo_url);
      }
    }
    const firstCheckIn = new Map(postRows.map((p) => [p.id, p.check_in_id]));
    const target = (postId: string, checkInId: string | null) =>
      notificationTarget({ perCheckIn, checkInId, firstCheckInId: firstCheckIn.get(postId) ?? null, scopedPhoto, postPhoto: postPhoto.get(postId) ?? null });

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
      const commentTarget = commentNotificationTarget({
        perCheckIn, checkInId: c.check_in_id, firstCheckInId: firstCheckIn.get(c.post_id) ?? null,
        scopedPhoto, postPhoto: postPhoto.get(c.post_id) ?? null, commentMedia: c.media_url,
      });
      items.push({
        key: `comment:${c.id}`,
        kind: replyToMe ? "reply" : "comment",
        actorId: c.user_id,
        // A GIF or photo with no words reads "{Name} sent a GIF".
        text: !(c.body ?? "").trim() && c.media_url
          ? mediaOnlyCommentLine(commentMediaKind(c.media_url, c.media_type) ?? "photo")
          : replyToMe
            ? "replied to your comment"
            : mine
              ? "commented on your check-in"
              : "also commented on a check-in",
        createdAt: c.created_at,
        mediaPath: commentTarget.mediaPath,
        mediaKind: null,
        groupId,
        postId: c.post_id,
        commentId: c.id,
        checkInId: commentTarget.checkInId,
      });
    }

    for (const r of reactionRows) {
      if (r.user_id === userId) continue;
      if (postAuthor.get(r.post_id) !== userId) continue;
      items.push({
        key: `reaction:${r.id}`,
        kind: "reaction",
        actorId: r.user_id,
        text: `reacted ${r.emoji} to your check-in`,
        createdAt: r.created_at,
        mediaPath: target(r.post_id, r.check_in_id).mediaPath,
        mediaKind: null,
        groupId,
        postId: r.post_id,
        checkInId: target(r.post_id, r.check_in_id).checkInId,
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
          commentId: l.comment_id,
        });
      }
    }
  }

  const messageRows = (messages ?? []) as Array<{
    id: string;
    user_id: string;
    body: string;
    image_url: string | null;
    created_at: string;
    shared_workout_code: string | null;
    shared_plan_slug: string | null;
  }>;
  const shareCodes = messageRows.map((m) => m.shared_workout_code).filter((c): c is string => !!c);
  const shareNames = new Map<string, string>();
  if (shareCodes.length > 0) {
    const { loadChatWorkoutCards } = await import("@/lib/shared-workouts.server");
    for (const [code, card] of await loadChatWorkoutCards(shareCodes)) shareNames.set(code, card.name);
  }
  const planSlugs = [...new Set(messageRows.map((m) => m.shared_plan_slug).filter((s): s is string => !!s))];
  const planNames = new Map<string, string>();
  if (planSlugs.length > 0) {
    const { data: planRows } = await supabase.from("plans").select("slug, name").in("slug", planSlugs);
    for (const p of planRows ?? []) planNames.set(p.slug as string, p.name as string);
  }
  for (const m of messageRows) {
    const preview = (m.body ?? "").trim();
    const shared = m.shared_workout_code ? (shareNames.get(m.shared_workout_code) ?? "Workout") : null;
    const sharedPlan = m.shared_plan_slug ? (planNames.get(m.shared_plan_slug) ?? "Plan") : null;
    items.push({
      key: `message:${m.id}`,
      kind: "message",
      actorId: m.user_id,
      text: sharedPlan
        ? `shared a plan: ${sharedPlan}`
        : shared
        ? `shared a workout: ${shared}`
        : preview
          ? `sent a message in ${groupName}: ${preview.slice(0, 60)}`
          : `sent a photo in ${groupName}`,
      createdAt: m.created_at,
      mediaPath: m.image_url ?? null,
      mediaKind: null,
      groupId,
      postId: null,
    });
  }

  // Map a check-in back to its feed post so the notification opens that post.
  const postByCheckIn = new Map<string, string>();
  for (const p of postRows) if (p.check_in_id) postByCheckIn.set(p.check_in_id, p.id);
  // A daily post stores only the first check-in ID, while every later check-in
  // from that member on the same day is rendered on that same feed card.
  const postByMemberDay = new Map<string, string>();
  for (const p of postRows) {
    postByMemberDay.set(`${p.user_id}:${p.local_date}`, p.id);
  }

  for (const c of (checkIns ?? []) as Array<{
    id: string;
    user_id: string;
    checkin_date: string;
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
      postId:
        postByCheckIn.get(c.id) ??
        postByMemberDay.get(`${c.user_id}:${c.checkin_date}`) ??
        null,
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

  // Pact signatures: "X made the pact", plus one celebratory item when the
  // last member makes it.
  const { data: pactRows } = await supabase
    .from("group_members")
    .select("user_id, pact_signed_at")
    .eq("group_id", groupId);

  const pacts = (pactRows ?? []) as Array<{ user_id: string; pact_signed_at: string | null }>;
  for (const p of pacts) {
    if (p.user_id === userId) continue;
    if (!p.pact_signed_at || p.pact_signed_at < from) continue;
    items.push({
      key: `pact:${groupId}:${p.user_id}`,
      kind: "pact_signed",
      actorId: p.user_id,
      text: `made the pact in ${groupName}`,
      createdAt: p.pact_signed_at,
      mediaPath: null,
      mediaKind: null,
      groupId,
      postId: null,
    });
  }

  if (pacts.length > 1 && pacts.every((p) => Boolean(p.pact_signed_at))) {
    const last = pacts
      .map((p) => p.pact_signed_at as string)
      .sort()
      .slice(-1)[0];
    if (last && last >= from) {
      items.push({
        key: `pact_done:${groupId}:${last}`,
        kind: "pact_complete",
        actorId: userId,
        text: "Everyone's in — the pact is made. Time to show up.",
        createdAt: last,
        mediaPath: null,
        mediaKind: null,
        groupId,
        postId: null,
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.filter(item => !blocked.has(item.actorId)).slice(0, 120);
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
  .inputValidator((input: { groupId: string; previewMedia?: boolean }) => {
    if (!input || typeof input.groupId !== "string") throw new Error("groupId required");
    return { groupId: input.groupId, previewMedia: input.previewMedia === true };
  })
  .handler(async ({ data, context }): Promise<{ items: NotificationItem[] }> => {
    const { supabase, userId } = context;

    // Every group the user belongs to; "all" aggregates across them.
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    const myGroupIds = ((memberships ?? []) as Array<{ group_id: string }>).map(
      (m) => m.group_id,
    );

    const groupIds =
      data.groupId === "all"
        ? myGroupIds
        : myGroupIds.filter((id) => id === data.groupId);
    if (groupIds.length === 0) return { items: [] };

    const { data: groups } = await supabase
      .from("groups")
      .select("id, name").is("ended_at", null)
      .in("id", groupIds);
    const nameById = new Map(
      ((groups ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]),
    );

    const lists = await Promise.all(
      (groups ?? []).map((group) => collect(supabase, userId, group.id, group.name, Boolean(data.previewMedia))),
    );
    const raw = lists
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 200);
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

    const { signActivityThumbs, signAvatarThumbs } = await import('./media-urls');
    const [avatarUrls, mediaUrls, read] = await Promise.all([
      data.previewMedia ? signAvatarThumbs(supabase, profRows.map(p => p.avatar_url)).then(map => Object.fromEntries(map)) :
      signMany(
        supabase,
        "avatars",
        profRows.map((p) => p.avatar_url ?? "").filter(Boolean),
      ),
      data.previewMedia ? signActivityThumbs(supabase, raw.map(r => r.mediaPath)).then(map => Object.fromEntries(map)) : signMany(
        supabase,
        "chat-photos",
        raw.map((r) => r.mediaPath ?? "").filter((p) => p && !p.startsWith("http")),
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
        mediaUrl: r.mediaPath ? (r.mediaPath.startsWith("http") ? (data.previewMedia && isVideo(r.mediaPath) ? null : r.mediaPath) : (mediaUrls[r.mediaPath] ?? null)) : null,
        mediaKind: r.mediaPath ? (data.previewMedia && mediaUrls[r.mediaPath] ? 'image' : isVideo(r.mediaPath) ? "video" : "image") : null,
        groupId: r.groupId,
        groupName: nameById.get(r.groupId) ?? "",
        postId: r.postId,
        commentId: r.commentId ?? null,
        ...(r.checkInId ? { checkInId: r.checkInId } : {}),
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
      .select("id, name").is("ended_at", null)
      .in("id", groupIds);
    const nameById = new Map(
      ((groups ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]),
    );

    const read = await readKeys(supabase, userId);
    const lists = await Promise.all(
      (groups ?? []).map((group) => collect(supabase, userId, group.id, group.name)),
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

/** Real unread total across all of the user's groups, mirrored to the badge row. */
async function computeUnreadTotal(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = ((memberships ?? []) as Array<{ group_id: string }>).map((m) => m.group_id);

  const { data: groups } = await supabase.from("groups").select("id, name").is("ended_at", null).in("id", groupIds);
  const nameById = new Map(
    ((groups ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name]),
  );

  const read = await readKeys(supabase, userId);
  const lists = await Promise.all(
    (groups ?? []).map((group) => collect(supabase, userId, group.id, group.name)),
  );
  const { data: prefs, error: prefsError } = await supabase.rpc('get_my_app_prefs');
  if (prefsError) throw new Error('Could not count notifications');
  const isNew = prefs?.[0]?.new_version_enabled && prefs?.[0]?.app_version === 'new';
  const visible = isNew ? lists.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 200) : lists.flat();
  const total = visible.filter(item => !read.has(item.key)).length;
  const { additionalActivityUnread } = await import('./profile-social.server');
  return total + await additionalActivityUnread(supabase, read);
}

/** New Activity's bell and native badge count the same visible notification window. */
export const getActivityUnreadCount = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => ({ total: await computeUnreadTotal(context.supabase, context.userId) }));

async function writeBadge(userId: string, count: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("user_badge_counts" as never)
    .upsert({ user_id: userId, count, updated_at: new Date().toISOString() } as never, {
      onConflict: "user_id",
    });
}

/** Recompute the app-icon badge from actual unread items (authoritative). */
export const syncBadgeCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const total = await computeUnreadTotal(supabase, userId);
    await writeBadge(userId, total);
    return { count: total };
  });

/**
 * Marks everything the user just opened as read: a whole group, or only the
 * notifications tied to one post / set of kinds. Returns the new badge total.
 */
export const markGroupNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { groupId: string; kinds?: NotificationKind[]; postId?: string | null }) => {
      if (!input || typeof input.groupId !== "string") throw new Error("groupId required");
      return {
        groupId: input.groupId,
        kinds: Array.isArray(input.kinds) ? input.kinds : null,
        postId: typeof input.postId === "string" ? input.postId : null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("group_members")
      .select("id, groups!inner(ended_at)").is("groups.ended_at", null)
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { ok: false, count: 0 };

    const raw = await collect(supabase, userId, data.groupId, "your group");
    const keys = raw
      .filter((r) => (data.kinds ? data.kinds.includes(r.kind) : true))
      .filter((r) => (data.postId ? r.postId === data.postId : true))
      .map((r) => r.key);

    if (keys.length > 0) {
      await supabase
        .from("notification_reads")
        .upsert(
          keys.map((k) => ({ user_id: userId, item_key: k })),
          { onConflict: "user_id,item_key" },
        );
    }

    const total = await computeUnreadTotal(supabase, userId);
    await writeBadge(userId, total);
    return { ok: true, count: total };
  });
