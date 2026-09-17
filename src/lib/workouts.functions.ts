import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateFor } from "@/lib/daily-posts.functions";

/**
 * "Start workout" — live accountability between the commitment and the proof.
 *
 * A session records that someone is doing the thing *right now* so their group
 * can see it and cheer. Starting is never completion: proof is still required
 * before a workout can be finished.
 */

export type WorkoutStatus = "active" | "completed" | "ended_without_completion";

export type WorkoutSession = {
  id: string;
  groupId: string;
  groupName: string;
  status: WorkoutStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  commitmentText: string | null;
  proofCompleted: boolean;
};

export type WorkoutState = {
  groupId: string | null;
  groupName: string | null;
  commitmentText: string | null;
  hasCommitment: boolean;
  checkedIn: boolean;
  session: WorkoutSession | null;
};

const CHEER_EMOJIS = ["🔥", "💪", "👏"] as const;

async function resolveGroupAndTz(
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
    if (member?.group_id) groupId = member.group_id as string;
  }
  if (!groupId) {
    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    groupId = (membership?.group_id as string | undefined) ?? null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return { groupId, timezone: (profile?.timezone as string | undefined) ?? "UTC" };
}

/** True when the user already captured proof for this group on this local day. */
async function hasProof(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  localDate: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("check_ins")
    .select("id")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .eq("checkin_date", localDate)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

function toSession(row: Record<string, unknown>, groupName: string): WorkoutSession {
  return {
    id: row["id"] as string,
    groupId: row["group_id"] as string,
    groupName,
    status: row["status"] as WorkoutStatus,
    startedAt: row["started_at"] as string,
    endedAt: (row["ended_at"] as string | null) ?? null,
    durationSeconds: (row["duration_seconds"] as number | null) ?? null,
    commitmentText: (row["commitment_text"] as string | null) ?? null,
    proofCompleted: Boolean(row["proof_completed"]),
  };
}

/** Everything Home needs to render the Start workout / in-progress card. */
export const getWorkoutState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ context, data }): Promise<WorkoutState> => {
    const { supabase, userId } = context;
    const { groupId, timezone } = await resolveGroupAndTz(supabase, userId, data.groupId);
    if (!groupId) {
      return {
        groupId: null,
        groupName: null,
        commitmentText: null,
        hasCommitment: false,
        checkedIn: false,
        session: null,
      };
    }
    const today = localDateFor(timezone);

    const [{ data: group }, { data: post }, { data: sessionRow }, proof] = await Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
      supabase
        .from("daily_posts")
        .select("id, morning_ritual_text, check_in_id")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .eq("local_date", today)
        .maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .eq("status", "active")
        .maybeSingle(),
      hasProof(supabase, userId, groupId, today),
    ]);

    const groupName = (group?.name as string) ?? "your group";
    const commitmentText = (post?.morning_ritual_text as string | null) ?? null;
    const checkedIn = proof || Boolean(post?.check_in_id);

    return {
      groupId,
      groupName,
      commitmentText,
      hasCommitment: Boolean(commitmentText),
      checkedIn,
      session: sessionRow
        ? toSession(sessionRow as Record<string, unknown>, groupName)
        : null,
    };
  });

/**
 * Starts (or returns) the active session for today's commitment.
 * Idempotent: double taps, retries and reconnects never create a second row.
 */
export const startWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { groupId, timezone } = await resolveGroupAndTz(supabase, userId, data.groupId);
    if (!groupId) throw new Error("You're not in a group yet");
    const today = localDateFor(timezone);

    const [{ data: group }, { data: post }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
      supabase
        .from("daily_posts")
        .select("id, morning_ritual_text")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .eq("local_date", today)
        .maybeSingle(),
    ]);
    const groupName = (group?.name as string) ?? "your group";
    const commitmentText = (post?.morning_ritual_text as string | null) ?? null;

    const { data: existing } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return {
        session: toSession(existing as Record<string, unknown>, groupName),
        created: false,
        notified: false,
      };
    }

    const { data: inserted, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userId,
        group_id: groupId,
        post_id: (post?.id as string | undefined) ?? null,
        local_date: today,
        commitment_text: commitmentText,
        status: "active",
      })
      .select("*")
      .maybeSingle();

    if (error || !inserted) {
      // Lost a race against another device — return the winner's session.
      const { data: raced } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .eq("status", "active")
        .maybeSingle();
      if (raced) {
        return {
          session: toSession(raced as Record<string, unknown>, groupName),
          created: false,
          notified: false,
        };
      }
      throw new Error(error?.message ?? "Couldn't start that workout");
    }

    // Notification fatigue: at most one workout-start push per person, per
    // group, per local day — restarting the same commitment stays quiet.
    let notified = false;
    const { data: alreadySentToday } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .eq("local_date", today)
      .eq("start_notification_sent", true)
      .limit(1)
      .maybeSingle();

    if (!alreadySentToday) {
      const { data: me } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle();
      const firstName = ((me?.name as string) ?? "").split(" ")[0] || "Someone";
      const sessionId = inserted.id as string;

      const { notifyGroupWorkout } = await import("@/lib/notify.server");
      await notifyGroupWorkout(
        groupId,
        userId,
        {
          title: `${firstName} just started their workout 💪`,
          body: commitmentText
            ? `${commitmentText} · ${groupName} — cheer them on`
            : `${groupName} — cheer them on`,
          url: `/groups/${groupId}?workout=${sessionId}`,
        },
        "workout_start_enabled",
      );
      await supabase
        .from("workout_sessions")
        .update({ start_notification_sent: true })
        .eq("id", sessionId);
      notified = true;
    }

    return {
      session: toSession(inserted as Record<string, unknown>, groupName),
      created: true,
      notified,
    };
  });

/**
 * Finishes an active session. Refuses to complete without proof — the caller
 * gets `needsProof` and can either record proof or end the session instead.
 */
export const finishWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    const sessionId = String(input?.sessionId ?? "").trim();
    if (!sessionId) throw new Error("Session is required");
    return { sessionId };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("That workout session is no longer available");

    const groupId = row.group_id as string;
    const localDate = row.local_date as string;
    const { data: group } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .maybeSingle();
    const groupName = (group?.name as string) ?? "your group";

    if (row.status !== "active") {
      return {
        needsProof: false,
        session: toSession(row as Record<string, unknown>, groupName),
        durationSeconds: (row.duration_seconds as number | null) ?? 0,
      };
    }

    const proof = await hasProof(supabase, userId, groupId, localDate);
    if (!proof) {
      return {
        needsProof: true,
        session: toSession(row as Record<string, unknown>, groupName),
        durationSeconds: null,
      };
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - Date.parse(row.started_at as string)) / 1000),
    );

    const { data: updated } = await supabase
      .from("workout_sessions")
      .update({
        status: "completed",
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        proof_completed: true,
      })
      .eq("id", data.sessionId)
      .select("*")
      .maybeSingle();

    // Optional completion push — a separate preference from workout starts.
    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle();
      const firstName = ((me?.name as string) ?? "").split(" ")[0] || "Someone";
      const { notifyGroupWorkout } = await import("@/lib/notify.server");
      await notifyGroupWorkout(
        groupId,
        userId,
        {
          title: `${firstName} showed up 🔥`,
          body: row.commitment_text
            ? `${row.commitment_text} complete · ${Math.round(durationSeconds / 60)} min`
            : `Workout complete · ${Math.round(durationSeconds / 60)} min`,
          url: `/groups/${groupId}`,
        },
        "workout_complete_enabled",
      );
    } catch (err) {
      console.warn("[workout] completion push failed", err);
    }

    return {
      needsProof: false,
      session: toSession(
        (updated ?? row) as Record<string, unknown>,
        groupName,
      ),
      durationSeconds,
    };
  });

/** Stops the session without claiming completion. The commitment stays open. */
export const endWorkoutWithoutCompleting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    const sessionId = String(input?.sessionId ?? "").trim();
    if (!sessionId) throw new Error("Session is required");
    return { sessionId };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("workout_sessions")
      .select("started_at, status")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("That workout session is no longer available");
    if (row.status !== "active") return { ok: true, durationSeconds: 0 };

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - Date.parse(row.started_at as string)) / 1000),
    );
    const { error } = await supabase
      .from("workout_sessions")
      .update({
        status: "ended_without_completion",
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true, durationSeconds };
  });

/** Someone in the group taps 🔥 / 💪 / 👏 on a live session. */
export const cheerWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; emoji: string }) => {
    const sessionId = String(input?.sessionId ?? "").trim();
    const emoji = String(input?.emoji ?? "").trim();
    if (!sessionId) throw new Error("Session is required");
    if (!CHEER_EMOJIS.includes(emoji as (typeof CHEER_EMOJIS)[number])) {
      throw new Error("Unsupported reaction");
    }
    return { sessionId, emoji };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("workout_sessions")
      .select("id, user_id, group_id, commitment_text")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("That workout is no longer available");
    if (session.user_id === userId) return { ok: true, alreadyCheered: true };

    const { error } = await supabase.from("workout_cheers").insert({
      session_id: data.sessionId,
      group_id: session.group_id as string,
      user_id: userId,
      emoji: data.emoji,
    });
    // Duplicate cheer — stay quiet rather than double-notifying.
    if (error) return { ok: true, alreadyCheered: true };

    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle();
      const firstName = ((me?.name as string) ?? "").split(" ")[0] || "Someone";
      const { notifyUsers } = await import("@/lib/notify.server");
      await notifyUsers(
        [session.user_id as string],
        {
          title: `${firstName} cheered you on ${data.emoji}`,
          body: "Keep going — your group is watching.",
          url: `/home`,
        },
        "group_activity_enabled",
      );
    } catch (err) {
      console.warn("[workout] cheer push failed", err);
    }

    return { ok: true, alreadyCheered: false };
  });

/** The live session behind a push deep link, with who has cheered so far. */
export const getWorkoutSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => ({
    sessionId: String(input?.sessionId ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!data.sessionId) return null;
    const { data: row } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!row) return null;

    const [{ data: group }, { data: profile }, { data: cheers }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", row.group_id as string).maybeSingle(),
      supabase
        .from("profiles")
        .select("name, avatar_color, avatar_url")
        .eq("id", row.user_id as string)
        .maybeSingle(),
      supabase.from("workout_cheers").select("emoji, user_id").eq("session_id", data.sessionId),
    ]);

    let avatarUrl: string | null = null;
    const path = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    if (path) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      avatarUrl = signed?.signedUrl ?? null;
    }

    const name = ((profile?.name as string) ?? "").trim() || "Member";
    return {
      session: toSession(row as Record<string, unknown>, (group?.name as string) ?? "your group"),
      member: {
        userId: row.user_id as string,
        name,
        firstName: name.split(" ")[0] || name,
        avatarUrl,
        avatarColor: (profile as { avatar_color?: string } | null)?.avatar_color ?? "#7C3AED",
        isYou: (row.user_id as string) === userId,
      },
      myCheers: ((cheers ?? []) as Array<{ emoji: string; user_id: string }>)
        .filter((c) => c.user_id === userId)
        .map((c) => c.emoji),
      cheerCount: (cheers ?? []).length,
    };
  });
