import { createServerFn } from "@tanstack/react-start";
import { commentMediaKind, commentProblem, commentPush } from "@/lib/comment-media";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatarThumbs, signFeedMedia, signVideoPosters } from "./media-urls";
import {
  addDaysIso,
  groupStreak as computeGroupStreak,
  localDateIn,
  weekCounts,
  weeklyTarget,
} from "./streak-rules";
import { memberOwnToday } from "./group-today-view";
import { feedDayNumber, type DayStat, type Reactor } from "./feed-view";

/** Returns today's local date (YYYY-MM-DD) for the given IANA timezone. */
export function localDateFor(timezone: string, when: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(when);
  } catch {
    return when.toISOString().slice(0, 10);
  }
}

/** Returns the local hour (0–23) for the given IANA timezone. */
export function localHourFor(timezone: string, when: Date = new Date()): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    });
    return parseInt(fmt.format(when), 10);
  } catch {
    return when.getUTCHours();
  }
}

/** Returns a UTC ISO timestamp corresponding to the given local wall time
 *  (YYYY-MM-DD plus hour/minute) in the given IANA timezone. */
export function zonedWallTimeToISO(
  timezone: string,
  localDate: string,
  hour: number,
  minute: number = 0,
): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
    const offset = asUTC - guess;
    return new Date(guess - offset).toISOString();
  } catch {
    return new Date(guess).toISOString();
  }
}

async function signAvatar(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60, { transform: { width: 192, height: 192, resize: "cover", quality: 75 } });
  return data?.signedUrl ?? null;
}

async function signPhoto(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("chat-photos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function getMyGroupAndTz(
  supabase: SupabaseClient,
  userId: string,
  preferredGroupId?: string | null,
) {
  let groupId: string | null = null;
  if (preferredGroupId) {
    const { data: member } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId)
      .eq("group_id", preferredGroupId)
      .maybeSingle();
    if (member?.group_id) groupId = member.group_id;
  }
  if (!groupId) {
    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    groupId = membership?.group_id ?? null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return {
    groupId,
    timezone: profile?.timezone ?? "UTC",
  };
}

/**
 * Resolves the set of groups a post should land in.
 * - `groupIds` (multi-post): filtered down to real memberships.
 * - otherwise: the single preferred/most-recent group.
 */
async function getMyTargetGroupsAndTz(
  supabase: SupabaseClient,
  userId: string,
  preferredGroupId?: string | null,
  groupIds?: string[] | null,
) {
  if (groupIds && groupIds.length > 0) {
    const { data: members } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId)
      .in("group_id", groupIds);
    const allowed = (members ?? []).map((m) => m.group_id as string);
    if (allowed.length > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .maybeSingle();
      return { groupIds: allowed, timezone: profile?.timezone ?? "UTC" };
    }
  }
  const { groupId, timezone } = await getMyGroupAndTz(supabase, userId, preferredGroupId);
  return { groupIds: groupId ? [groupId] : [], timezone };
}

export const saveMyTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { timezone: string }) => ({
    timezone: String(input?.timezone ?? "UTC").slice(0, 64),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.timezone === "UTC") {
      const { data: existing } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .maybeSingle();
      if (existing?.timezone && existing.timezone !== "UTC") {
        return { ok: true };
      }
    }
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: data.timezone })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Posts an extra "what's on your mind" thought; appears as another node on today's timeline. */
export const postThought = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text?: string; photoUrl?: string; groupId?: string | null }) => ({
    text: input?.text?.slice(0, 500)?.trim() ?? null,
    photoUrl: input?.photoUrl?.slice(0, 2000) ?? null,
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.text && !data.photoUrl) throw new Error("Empty thought");

    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId, data.groupId);
    if (!groupId) throw new Error("You're not in a group yet");

    const today = localDateFor(timezone);

    // Make sure a daily_posts row exists so the card renders.
    await supabase.from("daily_posts").upsert(
      { user_id: userId, group_id: groupId, local_date: today },
      { onConflict: "user_id,group_id,local_date" },
    );

    const { error } = await (supabase as any)
      .from("daily_thoughts")
      .insert({
        user_id: userId,
        group_id: groupId,
        local_date: today,
        text: data.text,
        photo_url: data.photoUrl,
      });
    if (error) throw new Error(error.message);

    // Bump the daily_posts updated_at so the card moves to the top.
    await supabase
      .from("daily_posts")
      .update({ updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .eq("local_date", today);

    try {
      const { notifyGroupActivity, displayName } = await import("@/lib/notify.server");
      const name = await displayName(userId);
      await notifyGroupActivity(groupId, userId, {
        title: `${name} shared a thought`,
        body: data.text ? data.text.slice(0, 120) : "Tap to see it 💭",
        url: "/home",
      });
    } catch (err) {
      console.warn("[thought] push failed", err);
    }

    return { ok: true };

  });

export const recordCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      note?: string;
      photoUrl?: string;
      mood?: string;
      activity?: string;
      groupId?: string | null;
      groupIds?: string[] | null;
    }) => ({
      note: input?.note?.slice(0, 500) ?? null,
      photoUrl: input?.photoUrl?.slice(0, 2000) ?? null,
      mood: input?.mood?.slice(0, 40) ?? null,
      activity: input?.activity?.slice(0, 40) ?? null,
      groupId: input?.groupId ?? null,
      groupIds: Array.isArray(input?.groupIds) ? input.groupIds.map(String).slice(0, 20) : null,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { groupIds, timezone } = await getMyTargetGroupsAndTz(
      supabase,
      userId,
      data.groupId,
      data.groupIds,
    );
    if (groupIds.length === 0) throw new Error("You're not in a group yet");

    const today = localDateFor(timezone);
    const newBadgeSet = new Set<number>();

    for (const groupId of groupIds) {
      const { data: checkIn, error: ciErr } = await supabase
        .from("check_ins")
        .insert({
          user_id: userId,
          group_id: groupId,
          checkin_date: today,
          note: data.note,
          photo_url: data.photoUrl,
          mood: data.mood,
          activity: data.activity,
        })
        .select("id")
        .single();
      if (ciErr) throw new Error(ciErr.message);

      // Upsert the daily post; link the FIRST check-in for backwards-compat and clear "missed".
      // Additional check-ins are surfaced via the per-day check_ins query in getGroupFeed.
      const { data: existing } = await supabase
        .from("daily_posts")
        .select("check_in_id")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .eq("local_date", today)
        .maybeSingle();

      const { data: postRow, error: dpErr } = await supabase
        .from("daily_posts")
        .upsert(
          {
            user_id: userId,
            group_id: groupId,
            local_date: today,
            check_in_id: existing?.check_in_id ?? checkIn.id,
            check_in_missed: false,
          },
          { onConflict: "user_id,group_id,local_date" },
        )
        .select("id")
        .single();
      if (dpErr) throw new Error(dpErr.message);


      try {
        const { awardBadgesForUser } = await import("./badges.functions");
        const earned = await awardBadgesForUser(supabase, userId, groupId);
        for (const b of earned) newBadgeSet.add(b);
      } catch (err) {
        console.error("badge award failed", err);
      }

      try {
        const { notifyGroupActivity, displayName } = await import("@/lib/notify.server");
        const name = await displayName(userId);
        await notifyGroupActivity(groupId, userId, {
          title: `${name} checked in 🔥`,
          body: data.note ? data.note.slice(0, 120) : "Tap to see their check-in",
          url: postRow?.id ? `/home?post=${postRow.id}` : "/home",

        });
      } catch (err) {
        console.warn("[check-in] push failed", err);
      }
    }

    return { ok: true, newBadges: Array.from(newBadgeSet), groupCount: groupIds.length };

  });

export type TimelineNode =
  | {
      kind: "ritual";
      id: string;
      text: string;
      at: string;
    }
  | {
      kind: "ritual_missed";
      id: string;
      at: string;
    }
  | {
      kind: "thought";
      id: string;
      text: string | null;
      photoUrl: string | null;
      posterUrl?: string | null;
      at: string;
    }
  | {
      kind: "check_in";
      id: string;
      mood: string | null;
      activity: string | null;
      note: string | null;
      photoUrl: string | null;
      posterUrl?: string | null;
      at: string;
    }
  | {
      kind: "check_in_missed";
      id: string;
      at: string;
      /** The missed day and the member's own "today", both in their timezone. */
      localDate: string;
      memberToday: string;
    }
  | {
      /** The day was covered by an automatic rest day — streak kept. */
      kind: "rested";
      id: string;
      at: string;
      /** The rested day and the member's own "today", both in their timezone. */
      localDate: string;
      memberToday: string;
    }
  | {
      kind: "pending";
      id: string;
    };

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

export type FeedItem = {
  id: string;
  groupId: string;
  userId: string;
  isMe: boolean;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  localDate: string;
  updatedAt: string;
  nodes: TimelineNode[];
  reactions: ReactionSummary[];
  /** Who cheered and with which emoji (one reaction per person). */
  reactors: Reactor[];
  commentCount: number;
  lastCommentAt: string | null;
  /** Newest comment on this post, for the preview under the action row. */
  latestComment: CommentPreview | null;
  /** The member's streak in this group as of this post's local date. */
  dayNumber: number;
  /** Distinct check-in days in that Mon–Sun week, up to this post's date. */
  weekCount: number;
};

export type CommentPreview = {
  authorName: string;
  isMine: boolean;
  body: string;
  mediaKind: "photo" | "gif" | "video" | null;
  thumbUrl: string | null;
};

export type FeedMember = {
  userId: string;
  name: string;
  firstName: string;
  avatarUrl: string | null;
  avatarColor: string;
  isMe: boolean;
};

export type FeedMeta = {
  viewerToday: string;
  weeklyTarget: number;
  members: FeedMember[];
  /** Per feed day: who checked in, rested or missed, members due, crew streak. */
  days: DayStat[];
  /** Crewmates whose own day is still open with no check-in or rest. */
  notYet: { userId: string; closesAt: string; nudgedAt: string | null }[];
  /** Members whose own today is covered by a rest day or freeze, with no check-in. */
  restingToday?: string[];
  milestones: { id: string; userId: string; streakDays: number; localDate: string; postId: string | null }[];
};

const FEED_STREAK_LOOKBACK_DAYS = 120;


export type PostComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorColor: string;
  authorAvatarUrl: string | null;
  body: string;
  mediaUrl: string | null;
  mediaKind: "image" | "video" | null;
  createdAt: string;
  isMine: boolean;
  likeCount: number;
  likedByMe: boolean;
  parentCommentId: string | null;
};

/** Days per feed page: today plus the 6 before it, then 7 more per scroll. */
const FEED_PAGE_DAYS = 7;

/** One page of the feed. `nextBefore` is the cursor for older days, null at the start of the group. */
export type GroupFeedPage = { items: FeedItem[]; meta: FeedMeta | null; nextBefore: string | null };

export const getGroupFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null; before?: string | null }) => ({
    groupId: input?.groupId ? String(input.groupId) : null,
    before: input?.before && /^\d{4}-\d{2}-\d{2}$/.test(String(input.before)) ? String(input.before) : null,
  }))
  .handler(async ({ context, data }): Promise<GroupFeedPage> => {
    const { supabase, userId } = context;
    let groupId: string | null = data.groupId;
    if (groupId) {
      const { data: m } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .maybeSingle();
      if (!m) groupId = null;
    }
    if (!groupId) {
      ({ groupId } = await getMyGroupAndTz(supabase, userId));
    }
    if (!groupId) return { items: [], meta: null, nextBefore: null };

    // The page covers 7 of the viewer's local days: today and the 6 before it,
    // or the 7 days before `before`. The first page has no upper bound so a
    // crewmate already on tomorrow still shows under Today.
    const now = new Date();
    const { data: viewerProfile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
    const viewerToday = localDateIn((viewerProfile?.timezone as string | null) || "UTC", now);
    const windowEnd = data.before ? addDaysIso(data.before, -1) : viewerToday;
    const windowStart = addDaysIso(windowEnd, -(FEED_PAGE_DAYS - 1));

    let postsQuery = supabase
      .from("daily_posts")
      .select(
        "id, user_id, local_date, morning_ritual_text, morning_ritual_posted_at, morning_missed, check_in_missed, updated_at, created_at",
      )
      .eq("group_id", groupId)
      .gte("local_date", windowStart);
    if (data.before) postsQuery = postsQuery.lt("local_date", data.before);
    const [{ data: posts, error }, olderRes, olderRestRes] = await Promise.all([
      postsQuery.order("updated_at", { ascending: false }).limit(1000),
      // The newest older day with anything on it; skips empty stretches.
      supabase
        .from("daily_posts")
        .select("local_date")
        .eq("group_id", groupId)
        .lt("local_date", windowStart)
        .order("local_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // ...or with a rest day or freeze on it, which has no post of its own.
      supabase
        .from("streak_freezes_used")
        .select("freeze_date")
        .eq("group_id", groupId)
        .lt("freeze_date", windowStart)
        .order("freeze_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const olderPost = (olderRes.data?.local_date as string | undefined) ?? null;
    const olderRest = (olderRestRes.data?.freeze_date as string | undefined) ?? null;
    const olderDate = olderPost && olderRest ? (olderPost > olderRest ? olderPost : olderRest) : olderPost ?? olderRest;
    const nextBefore = olderDate ? addDaysIso(olderDate, 1) : null;
    // No posts this week can still mean rest days and today's crew rows, so carry on.
    const noRows = Promise.resolve({ data: [] as any[], error: null });

    const postIds = (posts ?? []).map((p) => p.id);
    const posterIds = Array.from(new Set((posts ?? []).map((p) => p.user_id)));
    const dates = Array.from(new Set((posts ?? []).map((p) => p.local_date)));
    const historyStart = addDaysIso(windowStart, -FEED_STREAK_LOOKBACK_DAYS);
    const recentNudgeDay = addDaysIso(now.toISOString().slice(0, 10), -1);

    const [
      groupRes,
      rosterRes,
      checkInsResult,
      thoughtsResult,
      reactionsResult,
      commentsResult,
      freezesResult,
      historyRes,
      badgesRes,
      nudgesRes,
    ] = await Promise.all([
      supabase.from("groups").select("frequency, days_per_week").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("user_id, joined_at").eq("group_id", groupId),
      postIds.length
        ? supabase
            .from("check_ins")
            .select("id, user_id, checkin_date, mood, activity, note, photo_url, created_at")
            .eq("group_id", groupId)
            .in("user_id", posterIds)
            .in("checkin_date", dates)
        : noRows,
      postIds.length
        ? (supabase as any)
            .from("daily_thoughts")
            .select("id, user_id, local_date, text, photo_url, created_at")
            .eq("group_id", groupId)
            .in("user_id", posterIds)
            .in("local_date", dates)
        : noRows,
      postIds.length
        ? (supabase as any)
            .from("post_reactions")
            .select("post_id, user_id, emoji, created_at")
            .in("post_id", postIds)
            .order("created_at", { ascending: true })
        : noRows,
      postIds.length
        ? (supabase as any)
            .from("post_comments")
            .select("id, post_id, user_id, body, media_url, media_type, created_at")
            .in("post_id", postIds)
        : noRows,
      // Rest days and streak freezes: those days are kept, never "missed".
      supabase
        .from("streak_freezes_used")
        .select("user_id, freeze_date, kind")
        .eq("group_id", groupId)
        .gte("freeze_date", historyStart)
        .limit(20000),
      // Check-in days for streaks (Day n, crew streak) and day headers.
      supabase
        .from("check_ins")
        .select("user_id, checkin_date")
        .eq("group_id", groupId)
        .gte("checkin_date", historyStart)
        .order("checkin_date", { ascending: false })
        .limit(20000),
      (data.before
        ? supabase
            .from("earned_badges")
            .select("id, user_id, streak_days, earned_at")
            .eq("group_id", groupId)
            .gte("earned_at", `${addDaysIso(windowStart, -1)}T00:00:00Z`)
            .lt("earned_at", `${addDaysIso(data.before, 1)}T12:00:00Z`)
        : supabase
            .from("earned_badges")
            .select("id, user_id, streak_days, earned_at")
            .eq("group_id", groupId)
            .gte("earned_at", `${addDaysIso(windowStart, -1)}T00:00:00Z`)),
      supabase
        .from("member_nudges")
        .select("target_id, local_date, created_at")
        .eq("group_id", groupId)
        .eq("nudger_id", userId)
        .gte("local_date", recentNudgeDay),
    ]);

    const schedule = {
      frequency: (groupRes.data?.frequency as string | null) ?? null,
      days_per_week: (groupRes.data?.days_per_week as number | null) ?? null,
    };
    const roster = (rosterRes.data ?? []) as { user_id: string; joined_at: string }[];
    const rawReactions = ((reactionsResult as any).data ?? []) as { post_id: string; user_id: string; emoji: string }[];
    const rawComments = ((commentsResult as any).data ?? []) as {
      id: string; post_id: string; user_id: string; body: string | null;
      media_url: string | null; media_type: string | null; created_at: string;
    }[];

    const commentCountByPost = new Map<string, number>();
    const latestByPost = new Map<string, (typeof rawComments)[number]>();
    for (const c of rawComments) {
      commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
      const prev = latestByPost.get(c.post_id);
      if (!prev || prev.created_at < c.created_at) latestByPost.set(c.post_id, c);
    }

    // One profiles read for everyone the feed names: posters, crew, cheerers, commenters.
    const peopleIds = Array.from(
      new Set([
        ...posterIds,
        ...roster.map((r) => r.user_id),
        ...rawReactions.map((r) => r.user_id),
        ...[...latestByPost.values()].map((c) => c.user_id),
        userId,
      ]),
    );
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_color, avatar_url, timezone")
      .in("id", peopleIds);
    const tzMap = new Map((profiles ?? []).map((p) => [p.id, (p.timezone as string | null) || "UTC"]));

    const protectedKind = new Map<string, string>();
    const coveredByUser = new Map<string, Set<string>>();
    const checkInDaysByUser = new Map<string, Set<string>>();
    const setFor = (map: Map<string, Set<string>>, uid: string) => {
      let s = map.get(uid);
      if (!s) map.set(uid, (s = new Set()));
      return s;
    };
    for (const f of (freezesResult.data ?? []) as { user_id: string; freeze_date: string; kind: string }[]) {
      protectedKind.set(`${f.user_id}|${f.freeze_date}`, f.kind);
      setFor(coveredByUser, f.user_id).add(f.freeze_date);
    }
    for (const c of (historyRes.data ?? []) as { user_id: string; checkin_date: string }[]) {
      setFor(checkInDaysByUser, c.user_id).add(c.checkin_date);
    }

    const reactionsByPost = new Map<string, ReactionSummary[]>();
    const reactorsByPost = new Map<string, { user_id: string; emoji: string }[]>();
    for (const r of rawReactions) {
      const list = reactionsByPost.get(r.post_id) ?? [];
      const existing = list.find((x) => x.emoji === r.emoji);
      if (existing) {
        existing.count += 1;
        if (r.user_id === userId) existing.mine = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, mine: r.user_id === userId });
      }
      reactionsByPost.set(r.post_id, list);
      const people = reactorsByPost.get(r.post_id) ?? [];
      if (!people.some((x) => x.user_id === r.user_id)) people.push({ user_id: r.user_id, emoji: r.emoji });
      reactorsByPost.set(r.post_id, people);
    }

    const rawCheckIns = checkInsResult.data ?? [];
    const rawThoughts = (thoughtsResult.data ?? []) as {
      id: string; user_id: string; local_date: string; text: string | null;
      photo_url: string | null; created_at: string;
    }[];
    const avatarPaths = Array.from(new Set((profiles ?? []).map((p) => p.avatar_url).filter((path): path is string => !!path)));
    const commentMediaPaths = [...latestByPost.values()]
      .filter((c) => commentMediaKind(c.media_url, c.media_type) !== "video")
      .map((c) => c.media_url);
    const photoPaths = Array.from(new Set([...rawCheckIns, ...rawThoughts]
      .map((item) => item.photo_url as string | null)
      .concat(commentMediaPaths)
      .filter((path): path is string => !!path && !path.startsWith("http"))));
    // Two requests, regardless of how many repeated assets appear in the feed.
    // Avatars and photos are resized server-side to their display size.
    const [avatarUrls, photoUrls, posterUrls] = await Promise.all([
      signAvatarThumbs(supabase as SupabaseClient, avatarPaths),
      signFeedMedia(supabase as SupabaseClient, photoPaths),
      signVideoPosters(supabase as SupabaseClient, photoPaths),
    ]);
    const resolvePoster = (path: string | null | undefined) => (path ? posterUrls.get(path) ?? null : null);
    const resolvePhoto = (path: string | null | undefined) => !path ? null : path.startsWith("http") ? path : photoUrls.get(path) ?? null;
    const profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          {
            name: ((p.name as string | null) ?? "").trim() || "Member",
            avatar_color: (p.avatar_color as string | null) ?? "#22C55E",
            avatar_url: p.avatar_url ? avatarUrls.get(p.avatar_url) ?? null : null,
          },
        ] as const),
    );
    const firstNameOf = (uid: string) => (profileMap.get(uid)?.name ?? "Member").split(" ")[0] || "Member";

    const checkIns = rawCheckIns.map((ci) => ({
        ...ci,
        photo_url: resolvePhoto(ci.photo_url),
        poster_url: resolvePoster(ci.photo_url),
      }));
    const thoughts = rawThoughts.map((t) => ({
        ...t,
        photo_url: resolvePhoto(t.photo_url),
        poster_url: resolvePoster(t.photo_url),
      }));

    const items: FeedItem[] = (posts ?? []).map((p) => {
      const prof = profileMap.get(p.user_id);
      const nodes: TimelineNode[] = [];

      const tz = tzMap.get(p.user_id) ?? "UTC";
      const todayLocal = localDateFor(tz, now);
      const isPastDay = p.local_date < todayLocal;
      // Commitments posted before the daily commitment was retired stay in
      // history. No new ones are created and no "missed commitment" tiles show.
      if (p.morning_ritual_text) {
        nodes.push({
          kind: "ritual",
          id: `r-${p.id}`,
          text: p.morning_ritual_text,
          at: p.morning_ritual_posted_at ?? p.created_at,
        });
      }

      // Thoughts for this user + date
      const myThoughts = thoughts
        .filter((t) => t.user_id === p.user_id && t.local_date === p.local_date)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (const t of myThoughts) {
        nodes.push({
          kind: "thought",
          id: `t-${t.id}`,
          text: t.text ?? null,
          photoUrl: t.photo_url ?? null,
          posterUrl: t.poster_url ?? null,
          at: t.created_at,
        });
      }

      // Check-ins for this user + date
      const myCheckIns = checkIns
        .filter((c) => c.user_id === p.user_id && c.checkin_date === p.local_date)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (const c of myCheckIns) {
        nodes.push({
          kind: "check_in",
          id: `c-${c.id}`,
          mood: c.mood,
          activity: c.activity,
          note: c.note,
          photoUrl: c.photo_url ?? null,
          posterUrl: c.poster_url ?? null,
          at: c.created_at,
        });
      }

      // A closed day with no check-in shows "missed check-in" once the nightly
      // job has flagged it (or it carried an old commitment). A plain "what's
      // on your mind" update today is just an update, not a pending check-in.
      const coveredBy = protectedKind.get(`${p.user_id}|${p.local_date}`);
      if (myCheckIns.length === 0 && coveredBy) {
        nodes.push({
          kind: "rested",
          id: `rest-${p.id}`,
          at: zonedWallTimeToISO(tz, p.local_date, 23, 59),
          localDate: p.local_date,
          memberToday: todayLocal,
        });
      } else if (
        myCheckIns.length === 0 &&
        isPastDay &&
        !coveredBy &&
        (p.check_in_missed || Boolean(p.morning_ritual_text))
      ) {
        nodes.push({
          kind: "check_in_missed",
          id: `cm-${p.id}`,
          at: zonedWallTimeToISO(tz, p.local_date, 23, 59),
          localDate: p.local_date,
          memberToday: todayLocal,
        });
      }

      const memberCheckIns = new Set(checkInDaysByUser.get(p.user_id) ?? []);
      for (const c of myCheckIns) memberCheckIns.add(c.checkin_date);
      const latest = latestByPost.get(p.id);
      const latestKind = latest ? commentMediaKind(latest.media_url, latest.media_type) : null;

      return {
        id: p.id,
        groupId: groupId as string,
        userId: p.user_id,
        isMe: p.user_id === userId,
        name: prof?.name ?? "Member",
        avatarColor: prof?.avatar_color ?? "#22C55E",
        avatarUrl: prof?.avatar_url ?? null,
        localDate: p.local_date,
        updatedAt: p.updated_at,
        nodes,
        reactions: reactionsByPost.get(p.id) ?? [],
        reactors: (reactorsByPost.get(p.id) ?? []).map((r) => {
          const rp = profileMap.get(r.user_id);
          return {
            userId: r.user_id,
            name: rp?.name ?? "Member",
            firstName: firstNameOf(r.user_id),
            avatarUrl: rp?.avatar_url ?? null,
            avatarColor: rp?.avatar_color ?? "#22C55E",
            emoji: r.emoji,
            isMe: r.user_id === userId,
          };
        }),
        commentCount: commentCountByPost.get(p.id) ?? 0,
        lastCommentAt: latest?.created_at ?? null,
        latestComment: latest
          ? {
              authorName: latest.user_id === userId ? "You" : firstNameOf(latest.user_id),
              isMine: latest.user_id === userId,
              body: latest.body ?? "",
              mediaKind: latestKind,
              thumbUrl: latestKind && latestKind !== "video" ? resolvePhoto(latest.media_url) : null,
            }
          : null,
        dayNumber: myCheckIns.length
          ? feedDayNumber(memberCheckIns, coveredByUser.get(p.user_id) ?? [], p.local_date)
          : 0,
        weekCount: weekCounts(memberCheckIns, p.local_date).thisWeek,
      };
    });

    // Crew-wide day stats, each member on their own local dates.
    const crew = roster.map((r) => {
      const tz = tzMap.get(r.user_id) ?? "UTC";
      return {
        userId: r.user_id,
        tz,
        today: localDateIn(tz, now),
        joinedOn: localDateIn(tz, new Date(r.joined_at)),
        checkIns: checkInDaysByUser.get(r.user_id) ?? new Set<string>(),
        covered: coveredByUser.get(r.user_id) ?? new Set<string>(),
      };
    });
    const streakInputs = crew.map((m) => ({ joinedOn: m.joinedOn, kept: new Set([...m.checkIns, ...m.covered]) }));
    // Every day of the page, so quiet days (only rests or misses) still get a row.
    const dayDates: string[] = [];
    for (let d = windowEnd; d >= windowStart; d = addDaysIso(d, -1)) dayDates.push(d);
    const days: DayStat[] = dayDates.map((date) => {
      const checkedIn: string[] = [];
      const rested: string[] = [];
      const missed: string[] = [];
      let joined = 0;
      for (const m of crew) {
        if (m.joinedOn > date) continue;
        joined += 1;
        if (m.checkIns.has(date)) checkedIn.push(m.userId);
        else if (m.covered.has(date)) rested.push(m.userId);
        else if (date < m.today) missed.push(m.userId);
      }
      return {
        date,
        checkedIn,
        rested,
        missed,
        due: joined - rested.length,
        groupStreak: computeGroupStreak(streakInputs, date, FEED_STREAK_LOOKBACK_DAYS),
      };
    });

    const myNudgeDay = viewerToday;
    const nudgedAt = new Map<string, string>();
    for (const n of (nudgesRes.data ?? []) as { target_id: string; local_date: string; created_at: string }[]) {
      if (n.local_date === myNudgeDay) nudgedAt.set(n.target_id, n.created_at);
    }
    // "Hasn't checked in yet" rows belong to today, so only the first page has them.
    const notYet = crew
      .filter((m) => !data.before && m.userId !== userId && !m.checkIns.has(m.today) && !m.covered.has(m.today))
      .map((m) => ({
        userId: m.userId,
        closesAt: zonedWallTimeToISO(m.tz, addDaysIso(m.today, 1), 0, 0),
        nudgedAt: nudgedAt.get(m.userId) ?? null,
      }));

    // Today's own day already covered by a rest day or freeze, check-in or not posted.
    const restingToday = data.before
      ? []
      : crew.filter((m) => !m.checkIns.has(m.today) && m.covered.has(m.today)).map((m) => m.userId);

    // Streak badges (3 days and up); the 1-day badge is every first check-in.
    const milestones = ((badgesRes.data ?? []) as { id: string; user_id: string; streak_days: number; earned_at: string }[])
      .filter((b) => b.streak_days >= 3)
      .map((b) => {
        const localDate = localDateIn(tzMap.get(b.user_id) ?? "UTC", new Date(b.earned_at));
        const post = (posts ?? []).find((p) => p.user_id === b.user_id && p.local_date === localDate);
        return { id: b.id, userId: b.user_id, streakDays: b.streak_days, localDate, postId: post?.id ?? null };
      })
      .filter((m) => m.localDate >= windowStart && (!data.before || m.localDate < data.before));

    const members: FeedMember[] = peopleIds.map((uid) => {
      const prof = profileMap.get(uid);
      return {
        userId: uid,
        name: prof?.name ?? "Member",
        firstName: firstNameOf(uid),
        avatarUrl: prof?.avatar_url ?? null,
        avatarColor: prof?.avatar_color ?? "#22C55E",
        isMe: uid === userId,
      };
    });

    return {
      items,
      meta: {
        viewerToday,
        weeklyTarget: weeklyTarget(schedule),
        members,
        days,
        notYet,
        restingToday,
        milestones,
      },
      nextBefore,
    };
  });

export const deleteCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { checkInId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("check_ins")
      .delete()
      .eq("id", data.checkInId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePostReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { postId: string; emoji: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await (supabase as any)
      .from("post_reactions")
      .select("id")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .eq("emoji", data.emoji)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await (supabase as any).from("post_reactions").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { active: false };
    }
    const { error: clearError } = await (supabase as any)
      .from("post_reactions")
      .delete()
      .eq("post_id", data.postId)
      .eq("user_id", userId);
    if (clearError) throw new Error(clearError.message);
    const { error } = await (supabase as any)
      .from("post_reactions")
      .insert({ post_id: data.postId, user_id: userId, emoji: data.emoji });
    if (error) throw new Error(error.message);
    await (async () => {
      try {
        const { notifyPostAuthor } = await import("@/lib/notify.server");
        await notifyPostAuthor(data.postId, userId, (name) => ({
          title: `${name} reacted ${data.emoji}`,
          body: "Someone reacted to your post",
          url: `/home?post=${data.postId}`,
        }));
      } catch (err) {
        console.warn("[reaction] push failed", err);
      }
    })();
    return { active: true };

  });

export const setPostReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { postId: string; emoji: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: clearError } = await (supabase as any)
      .from("post_reactions")
      .delete()
      .eq("post_id", data.postId)
      .eq("user_id", userId);
    if (clearError) throw new Error(clearError.message);
    const { error } = await (supabase as any)
      .from("post_reactions")
      .insert({ post_id: data.postId, user_id: userId, emoji: data.emoji });
    if (error) throw new Error(error.message);
    await (async () => {
      try {
        const { notifyPostAuthor } = await import("@/lib/notify.server");
        await notifyPostAuthor(data.postId, userId, (name) => ({
          title: `${name} reacted ${data.emoji}`,
          body: "Someone reacted to your post",
          url: `/home?post=${data.postId}`,
        }));
      } catch (err) {
        console.warn("[reaction] push failed", err);
      }
    })();
    return { active: true };

  });

export const addPostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      postId: string;
      body?: string | null;
      mediaUrl?: string | null;
      mediaType?: string | null;
      parentCommentId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const body = (data.body ?? "").trim();
    const mediaUrl = data.mediaUrl?.trim() || null;
    const mediaType = mediaUrl ? data.mediaType?.trim() || null : null;
    const problem = commentProblem(body, mediaUrl);
    if (problem) throw new Error(problem);
    const { supabase, userId } = context;

    // Instagram/Facebook style: one level of nesting. Replying to a reply
    // attaches to the same top-level thread.
    let parentId: string | null = null;
    if (data.parentCommentId) {
      const { data: parent } = await (supabase as any)
        .from("post_comments")
        .select("id, parent_comment_id, post_id")
        .eq("id", data.parentCommentId)
        .maybeSingle();
      if (parent?.id && parent.post_id === data.postId) {
        parentId = parent.parent_comment_id ?? parent.id;
      }
    }

    const { error } = await (supabase as any).from("post_comments").insert({
      post_id: data.postId,
      user_id: userId,
      body,
      media_url: mediaUrl,
      media_type: mediaType,
      parent_comment_id: parentId,
    });
    if (error) throw new Error(error.message);
    try {
      const { notifyPostComment } = await import("@/lib/notify.server");
      const kind = commentMediaKind(mediaUrl, mediaType);
      await notifyPostComment(data.postId, userId, (name) => ({
        ...commentPush(name, body, kind),
        url: `/home?post=${data.postId}&comments=1`,
      }));
    } catch (err) {
      console.warn("[comment] push failed", err);
    }
    return { ok: true };
  });

export const toggleCommentLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { commentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await (supabase as any)
      .from("comment_likes")
      .select("id")
      .eq("comment_id", data.commentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await (supabase as any).from("comment_likes").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { liked: false };
    }
    const { error } = await (supabase as any)
      .from("comment_likes")
      .insert({ comment_id: data.commentId, user_id: userId });
    if (error) throw new Error(error.message);
    return { liked: true };
  });

export const getPostComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { postId: string }) => data)
  .handler(async ({ data, context }): Promise<{ comments: PostComment[] }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await (supabase as any)
      .from("post_comments")
      .select("id, post_id, user_id, body, media_url, media_type, created_at, parent_comment_id")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id))) as string[];
    const { data: profs } = ids.length
      ? await supabase
          .from("profiles")
          .select("id, name, avatar_color, avatar_url")
          .in("id", ids)
      : { data: [] as any[] };
    const avatarPaths = (profs ?? [])
      .map((p: any) => p.avatar_url)
      .filter((p: string | null): p is string => !!p);
    const signedMap = await signAvatarThumbs(supabase as SupabaseClient, avatarPaths);
    const mediaPaths = Array.from(
      new Set(
        (rows ?? [])
          .map((r: any) => r.media_url)
          .filter((p: string | null): p is string => !!p && !p.startsWith("http")),
      ),
    ) as string[];
    const mediaSigned = await signFeedMedia(supabase as SupabaseClient, mediaPaths);
    const commentIds = (rows ?? []).map((r: any) => r.id) as string[];
    const likeCounts = new Map<string, number>();
    const likedByMe = new Set<string>();
    if (commentIds.length) {
      const { data: likeRows } = await (supabase as any)
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
      (likeRows ?? []).forEach((l: any) => {
        likeCounts.set(l.comment_id, (likeCounts.get(l.comment_id) ?? 0) + 1);
        if (l.user_id === userId) likedByMe.add(l.comment_id);
      });
    }
    const profMap = new Map(
      (profs ?? []).map((p: any) => [
        p.id,
        {
          name: p.name ?? "Member",
          color: p.avatar_color ?? "#22C55E",
          avatarUrl: p.avatar_url ? signedMap.get(p.avatar_url) ?? null : null,
        },
      ] as const),
    );
    const comments: PostComment[] = (rows ?? []).map((r: any) => {
      const pr = profMap.get(r.user_id);
      const rawMedia: string | null = r.media_url ?? null;
      const mediaUrl = rawMedia
        ? rawMedia.startsWith("http")
          ? rawMedia
          : mediaSigned.get(rawMedia) ?? null
        : null;
      return {
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        authorName: pr?.name ?? "Member",
        authorColor: pr?.color ?? "#22C55E",
        authorAvatarUrl: pr?.avatarUrl ?? null,
        body: r.body,
        mediaUrl,
        mediaKind: rawMedia ? (String(r.media_type ?? "").startsWith("video/") ? "video" : "image") : null,
        createdAt: r.created_at,
        isMine: r.user_id === userId,
        likeCount: likeCounts.get(r.id) ?? 0,
        likedByMe: likedByMe.has(r.id),
        parentCommentId: r.parent_comment_id ?? null,
      };
    });
    return { comments };
  });

export type CelebrationTeammate = {
  id: string;
  initial: string;
  checkedIn: boolean;
  /** Own today (their timezone) covered by a rest or freeze row, no check-in. */
  resting: boolean;
  avatarUrl: string | null;
  avatarColor: string | null;
};
export type CelebrationData = {
  streakCount: number;
  groupName: string;
  teammates: CelebrationTeammate[];
};

export const getCheckInCelebrationData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ context, data }): Promise<CelebrationData> => {
    const { supabase, userId } = context;
    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId, data.groupId);
    if (!groupId) {
      return { streakCount: 1, groupName: "Your group", teammates: [] };
    }

    const today = localDateFor(timezone);

    // Compute current streak: walk back day-by-day while a check-in or applied freeze exists.
    const [{ data: recent }, { data: frozen }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("checkin_date")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .lte("checkin_date", today)
        .order("checkin_date", { ascending: false })
        .limit(400),
      supabase
        .from("streak_freezes_used")
        .select("freeze_date")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .lte("freeze_date", today)
        .limit(400),
    ]);
    const days = new Set<string>([
      ...((recent ?? []).map((r: any) => r.checkin_date as string)),
      ...((frozen ?? []).map((r: any) => r.freeze_date as string)),
    ]);
    let streak = 0;
    const cursor = new Date(`${today}T12:00:00Z`);
    // walk in UTC days; "good enough" — the local-day strings are already TZ-correct for today.
    while (true) {
      const iso = cursor.toISOString().slice(0, 10);
      if (days.has(iso)) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else break;
    }
    if (streak === 0) streak = 1; // we just checked in

    // Teammates' own today can be up to two days either side of yours.
    const dayBefore = addDaysIso(today, -2);
    const dayAfter = addDaysIso(today, 2);
    const [{ data: group }, { data: members }, { data: nearCheckIns }, { data: nearCovered }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      supabase
        .from("check_ins")
        .select("user_id, checkin_date")
        .eq("group_id", groupId)
        .gte("checkin_date", dayBefore)
        .lte("checkin_date", dayAfter),
      supabase
        .from("streak_freezes_used")
        .select("user_id, freeze_date")
        .eq("group_id", groupId)
        .gte("freeze_date", dayBefore)
        .lte("freeze_date", dayAfter),
    ]);
    const checkInDatesBy = new Map<string, Set<string>>();
    for (const c of nearCheckIns ?? []) {
      const u = (c as any).user_id as string;
      if (!checkInDatesBy.has(u)) checkInDatesBy.set(u, new Set());
      checkInDatesBy.get(u)!.add((c as any).checkin_date as string);
    }
    const coveredBy = new Map<string, Set<string>>();
    for (const f of nearCovered ?? []) {
      const u = (f as any).user_id as string;
      if (!coveredBy.has(u)) coveredBy.set(u, new Set());
      coveredBy.get(u)!.add((f as any).freeze_date as string);
    }

    const memberIds = (members ?? []).map((m: any) => m.user_id as string);
    const { data: profs } = memberIds.length
      ? await supabase
          .from("profiles")
          .select("id, name, avatar_color, avatar_url, timezone")
          .in("id", memberIds)
      : { data: [] as any[] };
    const avatarPaths = (profs ?? [])
      .map((p: any) => p.avatar_url)
      .filter((p: string | null): p is string => !!p);
    const signedMap = await signAvatarThumbs(supabase as SupabaseClient, avatarPaths);
    // Each teammate is judged only by their own today (same rule as the Groups list and Home).
    const teammates: CelebrationTeammate[] = (profs ?? []).map((p: any) => {
      const own = memberOwnToday({
        ownToday: localDateIn(p.timezone || "UTC"),
        checkInDates: checkInDatesBy.get(p.id),
        coveredDates: coveredBy.get(p.id),
        workingOut: false,
      });
      return {
        id: p.id,
        initial: (p.name ?? "?").trim().charAt(0).toUpperCase() || "•",
        checkedIn: own.status === "done",
        resting: own.resting,
        avatarUrl: p.avatar_url ? signedMap.get(p.avatar_url) ?? null : null,
        avatarColor: p.avatar_color ?? null,
      };
    });


    return {
      streakCount: streak,
      groupName: group?.name ?? "Your group",
      teammates,
    };
  });

