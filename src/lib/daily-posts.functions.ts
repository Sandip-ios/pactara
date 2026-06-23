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
    return fmt.format(when); // en-CA → YYYY-MM-DD
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

/** Saves the user's IANA timezone to their profile (auto-detected from browser). */
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

/** Posts (or updates) the user's morning ritual for today, in their timezone. */
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

/** Records a check-in and links it to today's daily post. */
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

    // Upsert the daily post and link the check-in.
    const { error: dpErr } = await supabase.from("daily_posts").upsert(
      {
        user_id: userId,
        group_id: groupId,
        local_date: today,
        check_in_id: checkIn.id,
        check_in_missed: false,
      },
      { onConflict: "user_id,group_id,local_date" },
    );
    if (dpErr) throw new Error(dpErr.message);

    return { ok: true };
  });

export type FeedItem = {
  id: string;
  userId: string;
  isMe: boolean;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  localDate: string;
  ritual: { text: string; postedAt: string } | null;
  ritualMissed: boolean;
  checkIn:
    | {
        id: string;
        mood: string | null;
        activity: string | null;
        note: string | null;
        photoUrl: string | null;
        createdAt: string;
      }
    | null;
  checkInMissed: boolean;
  updatedAt: string;
};

/** Returns the activity feed (recent daily posts) for the user's current group. */
export const getGroupFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: FeedItem[] }> => {
    const { supabase, userId } = context;
    const { groupId } = await getMyGroupAndTz(supabase, userId);
    if (!groupId) return { items: [] };

    const { data: posts, error } = await supabase
      .from("daily_posts")
      .select(
        "id, user_id, local_date, morning_ritual_text, morning_ritual_posted_at, morning_missed, check_in_id, check_in_missed, updated_at, created_at",
      )
      .eq("group_id", groupId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    if (!posts || posts.length === 0) return { items: [] };

    const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
    const checkInIds = posts
      .map((p) => p.check_in_id)
      .filter((id): id is string => Boolean(id));

    const [{ data: profiles }, checkInsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, avatar_color, avatar_url")
        .in("id", userIds),
      checkInIds.length
        ? supabase
            .from("check_ins")
            .select("id, mood, activity, note, photo_url, created_at")
            .in("id", checkInIds)
        : Promise.resolve({ data: [], error: null }),
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

    const checkInMap = new Map<string, NonNullable<FeedItem["checkIn"]>>();
    for (const ci of checkInsResult.data ?? []) {
      checkInMap.set(ci.id, {
        id: ci.id,
        mood: ci.mood,
        activity: ci.activity,
        note: ci.note,
        photoUrl: await signPhoto(supabase, ci.photo_url),
        createdAt: ci.created_at,
      });
    }

    const items: FeedItem[] = posts.map((p) => {
      const prof = profileMap.get(p.user_id);
      return {
        id: p.id,
        userId: p.user_id,
        isMe: p.user_id === userId,
        name: prof?.name ?? "Member",
        avatarColor: prof?.avatar_color ?? "#22C55E",
        avatarUrl: prof?.avatar_url ?? null,
        localDate: p.local_date,
        ritual: p.morning_ritual_text
          ? {
              text: p.morning_ritual_text,
              postedAt: p.morning_ritual_posted_at ?? p.created_at,
            }
          : null,
        ritualMissed: p.morning_missed,
        checkIn: p.check_in_id ? checkInMap.get(p.check_in_id) ?? null : null,
        checkInMissed: p.check_in_missed,
        updatedAt: p.updated_at,
      };
    });

    return { items };
  });
