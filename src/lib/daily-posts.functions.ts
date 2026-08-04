import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
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

export const postMorningRitual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; groupId?: string | null }) => ({
    text: String(input?.text ?? "").slice(0, 280).trim(),
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.text) throw new Error("Empty ritual");

    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId, data.groupId);
    if (!groupId) throw new Error("You're not in a group yet");

    const today = localDateFor(timezone);

    const { error } = await supabase.from("daily_posts").upsert(
      {
        user_id: userId,
        group_id: groupId,
        local_date: today,
        morning_ritual_text: data.text,
        morning_ritual_posted_at: new Date().toISOString(),
        morning_missed: false,
      },
      { onConflict: "user_id,group_id,local_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTodayRitualStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId, data.groupId);
    if (!groupId) return { posted: false, beforeNoon: localHourFor(timezone) < 12 };
    const today = localDateFor(timezone);
    const { data: post } = await supabase
      .from("daily_posts")
      .select("morning_ritual_posted_at")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .eq("local_date", today)
      .maybeSingle();
    return {
      posted: Boolean(post?.morning_ritual_posted_at),
      beforeNoon: localHourFor(timezone) < 12,
    };
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
    (input: { note?: string; photoUrl?: string; mood?: string; activity?: string; groupId?: string | null }) => ({
      note: input?.note?.slice(0, 500) ?? null,
      photoUrl: input?.photoUrl?.slice(0, 2000) ?? null,
      mood: input?.mood?.slice(0, 40) ?? null,
      activity: input?.activity?.slice(0, 40) ?? null,
      groupId: input?.groupId ?? null,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId, data.groupId);
    if (!groupId) throw new Error("You're not in a group yet");

    const today = localDateFor(timezone);

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

    const { error: dpErr } = await supabase.from("daily_posts").upsert(
      {
        user_id: userId,
        group_id: groupId,
        local_date: today,
        check_in_id: existing?.check_in_id ?? checkIn.id,
        check_in_missed: false,
      },
      { onConflict: "user_id,group_id,local_date" },
    );
    if (dpErr) throw new Error(dpErr.message);

    let newBadges: number[] = [];
    try {
      const { awardBadgesForUser } = await import("./badges.functions");
      newBadges = await awardBadgesForUser(supabase, userId, groupId);
    } catch (err) {
      console.error("badge award failed", err);
    }

    try {
      const { notifyGroupActivity, displayName } = await import("@/lib/notify.server");
      const name = await displayName(userId);
      await notifyGroupActivity(groupId, userId, {
        title: `${name} checked in 🔥`,
        body: data.note ? data.note.slice(0, 120) : "Tap to see their check-in",
        url: "/home",
      });
    } catch (err) {
      console.warn("[check-in] push failed", err);
    }

    return { ok: true, newBadges };

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
      at: string;
    }
  | {
      kind: "check_in";
      id: string;
      mood: string | null;
      activity: string | null;
      note: string | null;
      photoUrl: string | null;
      at: string;
    }
  | {
      kind: "check_in_missed";
      id: string;
      at: string;
    }
  | {
      kind: "pending";
      id: string;
    };

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

export type FeedItem = {
  id: string;
  userId: string;
  isMe: boolean;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  localDate: string;
  updatedAt: string;
  nodes: TimelineNode[];
  reactions: ReactionSummary[];
  commentCount: number;
};

export type PostComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorColor: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export const getGroupFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ? String(input.groupId) : null,
  }))
  .handler(async ({ context, data }): Promise<{ items: FeedItem[] }> => {
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
    if (!groupId) return { items: [] };

    // Ensure today's missed morning rituals exist as soon as each member passes
    // noon locally, even if the hourly job has not run against this group yet.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: groupMembers } = await supabaseAdmin
      .from("group_members")
      .select("user_id, joined_at")
      .eq("group_id", groupId);
    const memberIdsForMisses = Array.from(new Set((groupMembers ?? []).map((m) => m.user_id)));
    if (memberIdsForMisses.length > 0) {
      const { data: memberProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, timezone")
        .in("id", memberIdsForMisses);
      const timezoneByMember = new Map((memberProfiles ?? []).map((p) => [p.id, p.timezone ?? "UTC"]));
      const nowForMisses = new Date();
      const candidates = (groupMembers ?? [])
        .map((m) => {
          const timezone = timezoneByMember.get(m.user_id) ?? "UTC";
          const today = localDateFor(timezone, nowForMisses);
          const joinedLocalDate = localDateFor(timezone, new Date(m.joined_at));
          return { userId: m.user_id, today, eligible: localHourFor(timezone, nowForMisses) >= 12 && today >= joinedLocalDate };
        })
        .filter((m) => m.eligible);

      if (candidates.length > 0) {
        const candidateDates = Array.from(new Set(candidates.map((c) => c.today)));
        const { data: existingTodayPosts } = await supabaseAdmin
          .from("daily_posts")
          .select("id, user_id, local_date, morning_ritual_posted_at, morning_missed")
          .eq("group_id", groupId)
          .in("user_id", memberIdsForMisses)
          .in("local_date", candidateDates);
        const existingByMemberDate = new Map(
          (existingTodayPosts ?? []).map((p) => [`${p.user_id}:${p.local_date}`, p] as const),
        );

        await Promise.all(
          candidates.map(async (candidate) => {
            const existing = existingByMemberDate.get(`${candidate.userId}:${candidate.today}`);
            if (!existing) {
              await supabaseAdmin.from("daily_posts").insert({
                user_id: candidate.userId,
                group_id: groupId,
                local_date: candidate.today,
                morning_missed: true,
              });
            } else if (!existing.morning_ritual_posted_at && !existing.morning_missed) {
              await supabaseAdmin.from("daily_posts").update({ morning_missed: true }).eq("id", existing.id);
            }
          }),
        );
      }
    }


    const { data: posts, error } = await supabase
      .from("daily_posts")
      .select(
        "id, user_id, local_date, morning_ritual_text, morning_ritual_posted_at, morning_missed, check_in_missed, updated_at, created_at",
      )
      .eq("group_id", groupId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    if (!posts || posts.length === 0) return { items: [] };

    // Per-user timezones so we can derive "missed" without waiting for cron.
    const { data: tzProfiles } = await supabase
      .from("profiles")
      .select("id, timezone")
      .in("id", Array.from(new Set((posts ?? []).map((p) => p.user_id))));
    const tzMap = new Map((tzProfiles ?? []).map((p) => [p.id, p.timezone ?? "UTC"]));
    const now = new Date();

    const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
    const dates = Array.from(new Set(posts.map((p) => p.local_date)));

    const [{ data: profiles }, checkInsResult, thoughtsResult, reactionsResult, commentsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, avatar_color, avatar_url")
        .in("id", userIds),
      supabase
        .from("check_ins")
        .select("id, user_id, checkin_date, mood, activity, note, photo_url, created_at")
        .eq("group_id", groupId)
        .in("user_id", userIds)
        .in("checkin_date", dates),
      (supabase as any)
        .from("daily_thoughts")
        .select("id, user_id, local_date, text, photo_url, created_at")
        .eq("group_id", groupId)
        .in("user_id", userIds)
        .in("local_date", dates),
      (supabase as any)
        .from("post_reactions")
        .select("post_id, user_id, emoji")
        .in("post_id", posts.map((p) => p.id)),
      (supabase as any)
        .from("post_comments")
        .select("post_id")
        .in("post_id", posts.map((p) => p.id)),
    ]);

    const reactionsByPost = new Map<string, ReactionSummary[]>();
    for (const r of ((reactionsResult as any).data ?? []) as { post_id: string; user_id: string; emoji: string }[]) {
      const list = reactionsByPost.get(r.post_id) ?? [];
      const existing = list.find((x) => x.emoji === r.emoji);
      if (existing) {
        existing.count += 1;
        if (r.user_id === userId) existing.mine = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, mine: r.user_id === userId });
      }
      reactionsByPost.set(r.post_id, list);
    }

    const commentCountByPost = new Map<string, number>();
    for (const c of ((commentsResult as any).data ?? []) as { post_id: string }[]) {
      commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
    }


    const profileMap = new Map(
      await Promise.all(
        (profiles ?? []).map(async (p) => [
          p.id,
          {
            name: p.name,
            avatar_color: p.avatar_color,
            avatar_url: await signAvatar(supabase, p.avatar_url),
          },
        ] as const),
      ),
    );

    // Sign photos once.
    const checkIns = await Promise.all(
      (checkInsResult.data ?? []).map(async (ci) => ({
        ...ci,
        photo_url: await signPhoto(supabase, ci.photo_url),
      })),
    );
    const thoughts = await Promise.all(
      ((thoughtsResult as any).data ?? []).map(async (t: any) => ({
        ...t,
        photo_url: await signPhoto(supabase, t.photo_url),
      })),
    );

    const items: FeedItem[] = posts.map((p) => {
      const prof = profileMap.get(p.user_id);
      const nodes: TimelineNode[] = [];

      const tz = tzMap.get(p.user_id) ?? "UTC";
      const todayLocal = localDateFor(tz, now);
      const localHour = localHourFor(tz, now);
      const isToday = p.local_date === todayLocal;
      const isPastDay = p.local_date < todayLocal;
      const ritualMissed = !p.morning_ritual_text && (isPastDay || (isToday && localHour >= 12));
      const checkInMissed = isPastDay;

      // Morning ritual (or missed)
      if (p.morning_ritual_text) {
        nodes.push({
          kind: "ritual",
          id: `r-${p.id}`,
          text: p.morning_ritual_text,
          at: p.morning_ritual_posted_at ?? p.created_at,
        });
      } else if (ritualMissed) {
        nodes.push({
          kind: "ritual_missed",
          id: `rm-${p.id}`,
          at: zonedWallTimeToISO(tz, p.local_date, 12, 0),
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
          at: c.created_at,
        });
      }

      if (myCheckIns.length === 0) {
        if (checkInMissed) {
          nodes.push({
            kind: "check_in_missed",
            id: `cm-${p.id}`,
            at: zonedWallTimeToISO(tz, p.local_date, 23, 59),
          });
        } else {
          nodes.push({ kind: "pending", id: `p-${p.id}` });
        }
      }

      return {
        id: p.id,
        userId: p.user_id,
        isMe: p.user_id === userId,
        name: prof?.name ?? "Member",
        avatarColor: prof?.avatar_color ?? "#22C55E",
        avatarUrl: prof?.avatar_url ?? null,
        localDate: p.local_date,
        updatedAt: p.updated_at,
        nodes,
        reactions: reactionsByPost.get(p.id) ?? [],
        commentCount: commentCountByPost.get(p.id) ?? 0,
      };
    });

    return { items };
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
          url: "/home",
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
          url: "/home",
        }));
      } catch (err) {
        console.warn("[reaction] push failed", err);
      }
    })();
    return { active: true };

  });

export const addPostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { postId: string; body: string }) => data)
  .handler(async ({ data, context }) => {
    const body = data.body.trim();
    if (!body) throw new Error("Comment cannot be empty");
    if (body.length > 1000) throw new Error("Comment is too long");
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("post_comments")
      .insert({ post_id: data.postId, user_id: userId, body });
    if (error) throw new Error(error.message);
    try {
      const { notifyPostAuthor } = await import("@/lib/notify.server");
      await notifyPostAuthor(data.postId, userId, (name) => ({
        title: `${name} commented`,
        body: body.slice(0, 120),
        url: "/home",
      }));
    } catch (err) {
      console.warn("[comment] push failed", err);
    }
    return { ok: true };
  });

export const getPostComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { postId: string }) => data)
  .handler(async ({ data, context }): Promise<{ comments: PostComment[] }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await (supabase as any)
      .from("post_comments")
      .select("id, post_id, user_id, body, created_at")
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
    const signedMap = new Map<string, string>();
    if (avatarPaths.length) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrls(avatarPaths, 60 * 60);
      (signed ?? []).forEach((s: any) => {
        if (s?.path && s?.signedUrl) signedMap.set(s.path, s.signedUrl);
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
      return {
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        authorName: pr?.name ?? "Member",
        authorColor: pr?.color ?? "#22C55E",
        authorAvatarUrl: pr?.avatarUrl ?? null,
        body: r.body,
        createdAt: r.created_at,
        isMine: r.user_id === userId,
      };
    });
    return { comments };
  });

export type CelebrationTeammate = { id: string; initial: string; checkedIn: boolean };
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

    const [{ data: group }, { data: members }, { data: todayCheckIns }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      supabase
        .from("check_ins")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("checkin_date", today),
    ]);

    const memberIds = (members ?? []).map((m: any) => m.user_id as string);
    const { data: profs } = memberIds.length
      ? await supabase.from("profiles").select("id, name").in("id", memberIds)
      : { data: [] as any[] };
    const checkedSet = new Set((todayCheckIns ?? []).map((c: any) => c.user_id as string));
    // NOTE: real share-card rendering of teammates requires explicit group consent.
    // We surface initials only here; do not add real names/avatars to exported images.
    const teammates: CelebrationTeammate[] = (profs ?? []).map((p: any) => ({
      id: p.id,
      initial: (p.name ?? "?").trim().charAt(0).toUpperCase() || "•",
      checkedIn: checkedSet.has(p.id),
    }));

    return {
      streakCount: streak,
      groupName: group?.name ?? "Your group",
      teammates,
    };
  });

