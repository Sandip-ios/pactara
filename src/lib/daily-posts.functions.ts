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

async function getMyGroupAndTz(supabase: SupabaseClient, userId: string) {
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return {
    groupId: membership?.group_id ?? null,
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
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: data.timezone })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const postMorningRitual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) => ({
    text: String(input?.text ?? "").slice(0, 280).trim(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.text) throw new Error("Empty ritual");

    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId);
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

/** Posts an extra "what's on your mind" thought; appears as another node on today's timeline. */
export const postThought = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text?: string; photoUrl?: string }) => ({
    text: input?.text?.slice(0, 500)?.trim() ?? null,
    photoUrl: input?.photoUrl?.slice(0, 2000) ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.text && !data.photoUrl) throw new Error("Empty thought");

    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId);
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

    return { ok: true };
  });

export const recordCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { note?: string; photoUrl?: string; mood?: string; activity?: string }) => ({
      note: input?.note?.slice(0, 500) ?? null,
      photoUrl: input?.photoUrl?.slice(0, 2000) ?? null,
      mood: input?.mood?.slice(0, 40) ?? null,
      activity: input?.activity?.slice(0, 40) ?? null,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { groupId, timezone } = await getMyGroupAndTz(supabase, userId);
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

    return { ok: true };
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
};

export const getGroupFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: FeedItem[] }> => {
    const { supabase, userId } = context;
    const { groupId } = await getMyGroupAndTz(supabase, userId);
    if (!groupId) return { items: [] };

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

    const [{ data: profiles }, checkInsResult, thoughtsResult] = await Promise.all([
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
    ]);

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
          at: p.updated_at,
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
          nodes.push({ kind: "check_in_missed", id: `cm-${p.id}`, at: p.updated_at });
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
      };
    });

    return { items };
  });
