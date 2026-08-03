import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateFor } from "@/lib/daily-posts.functions";

async function getUserTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return (data?.timezone as string | undefined) ?? "UTC";
}

async function signAvatar(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/**
 * Public preview of a group for the invite landing page. Returns minimal
 * info (name, emoji, member count, member display names + avatars, and the
 * inviter — the group owner). Uses the admin client server-side and projects
 * only safe columns.
 */
export const getGroupPreview = createServerFn({ method: "GET" })
  .inputValidator((input: { groupId: string }) => {
    const id = String(input?.groupId ?? "").trim();
    if (!id) throw new Error("Group ID required");
    return { groupId: id };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: group, error: gErr } = await supabaseAdmin
      .from("groups")
      .select("id, name, emoji, goal, duration_days, owner_id, created_at")
      .eq("id", data.groupId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!group) throw new Error("Group not found");


    const { data: members, error: mErr } = await supabaseAdmin
      .from("group_members")
      .select("user_id, joined_at")
      .eq("group_id", data.groupId)
      .order("joined_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    const memberIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, avatar_color, avatar_url")
      .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

    const signed = await Promise.all(
      (profiles ?? []).map(async (p) => {
        const path = (p as { avatar_url?: string | null }).avatar_url ?? null;
        let url: string | null = null;
        if (path) {
          const { data: s } = await supabaseAdmin.storage
            .from("avatars")
            .createSignedUrl(path, 60 * 60);
          url = s?.signedUrl ?? null;
        }
        return {
          id: p.id,
          name: (p.name ?? "").split(" ")[0] || "Member",
          fullName: (p.name ?? "") as string,
          avatarColor: (p as { avatar_color?: string | null }).avatar_color ?? "#7C3AED",
          avatarUrl: url,
        };
      }),
    );

    const inviter = signed.find((s) => s.id === group.owner_id) ?? signed[0] ?? null;

    return {
      id: group.id,
      name: group.name as string,
      emoji: (group.emoji as string) ?? "🔥",
      goal: ((group as { goal?: string | null }).goal ?? null) as string | null,
      durationDays: ((group as { duration_days?: number | null }).duration_days ?? 30) as number,
      memberCount: signed.length,
      members: signed,
      inviter,
    };
  });


/**
 * Joins the current user to a group via an invite link. Idempotent.
 */
export const joinGroupById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    const id = String(input?.groupId ?? "").trim();
    if (!id) throw new Error("Group ID required");
    return { groupId: id };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: group, error: gErr } = await supabaseAdmin
      .from("groups")
      .select("id")
      .eq("id", data.groupId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!group) throw new Error("Group not found");

    const { data: existing } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin
        .from("group_members")
        .insert({ group_id: data.groupId, user_id: userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true, groupId: data.groupId };
  });

/**
 * Returns the current user's primary (most recent) group along with the
 * member count and the user's display name. Used to gate the home screen
 * against the invite screen.
 */
export const getMyGroupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Find a group the user is a member of (most recently joined).
    const { data: membership, error: memErr } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memErr) throw new Error(memErr.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const firstName = (profile?.name ?? "").split(" ")[0] || "there";
    const avatarUrl = await signAvatar(
      supabase,
      (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    );

    if (!membership) {
      return {
        hasGroup: false as const,
        memberCount: 0,
        firstName,
        avatarUrl,
        group: null,
      };
    }

    const { data: group, error: gErr } = await supabase
      .from("groups")
      .select("id, name, emoji, created_at")
      .eq("id", membership.group_id)
      .maybeSingle();

    if (gErr) throw new Error(gErr.message);

    const { count, error: cErr } = await supabase
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", membership.group_id);
    if (cErr) throw new Error(cErr.message);

    return {
      hasGroup: true as const,
      memberCount: count ?? 0,
      firstName,
      avatarUrl,
      group: group ?? null,
    };
  });

/**
 * Lists all groups the current user is a member of, with member counts and
 * the user's role in each (admin/member).
 */
export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: memberships, error: mErr } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });
    if (mErr) throw new Error(mErr.message);

    if (!memberships || memberships.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_color, avatar_url, timezone")
        .eq("id", userId)
        .maybeSingle();
      const avatarUrl = await signAvatar(
        supabase,
        (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      );
      return {
        groups: [],
        firstName: (profile?.name ?? "").split(" ")[0] || "there",
        avatarColor: profile?.avatar_color ?? "#22C55E",
        avatarUrl,
        timezone: profile?.timezone ?? "UTC",
      };
    }

    const groupIds = memberships.map((m) => m.group_id);
    const { data: groups, error: gErr } = await supabase
      .from("groups")
      .select("id, name, emoji, goal, owner_id, created_at, duration_days, start_date, frequency, days_per_week")
      .in("id", groupIds);
    if (gErr) throw new Error(gErr.message);

    const { data: allMembers, error: amErr } = await supabase
      .from("group_members")
      .select("group_id, user_id, joined_at")
      .in("group_id", groupIds);
    if (amErr) throw new Error(amErr.message);

    const allMemberIds = Array.from(new Set((allMembers ?? []).map((m) => m.user_id)));
    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_color, avatar_url")
      .in("id", allMemberIds.length ? allMemberIds : ["00000000-0000-0000-0000-000000000000"]);

    const profileById = new Map<string, { id: string; name: string; avatarColor: string; avatarUrl: string | null }>();
    await Promise.all(
      (memberProfiles ?? []).map(async (p) => {
        const path = (p as { avatar_url?: string | null }).avatar_url ?? null;
        const url = await signAvatar(supabase, path);
        profileById.set(p.id as string, {
          id: p.id as string,
          name: ((p.name as string) ?? "").trim(),
          avatarColor: (p as { avatar_color?: string | null }).avatar_color ?? "#7C3AED",
          avatarUrl: url,
        });
      }),
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_color, avatar_url, timezone")
      .eq("id", userId)
      .maybeSingle();
    const avatarUrl = await signAvatar(
      supabase,
      (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    );

    const out = (groups ?? []).map((g) => {
      const members = (allMembers ?? [])
        .filter((m) => m.group_id === g.id)
        .sort((a, b) => new Date(a.joined_at as string).getTime() - new Date(b.joined_at as string).getTime())
        .map((m) => {
          const p = profileById.get(m.user_id);
          return {
            id: m.user_id as string,
            name: p?.name || "Member",
            avatarColor: p?.avatarColor || "#7C3AED",
            avatarUrl: p?.avatarUrl ?? null,
            isYou: m.user_id === userId,
            isAdmin: g.owner_id === m.user_id,
          };
        });
      return {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        goal: (g as { goal?: string | null }).goal ?? null,
        isAdmin: g.owner_id === userId,
        memberCount: members.length,
        members,
        createdAt: g.created_at,
        durationDays: (g as { duration_days?: number }).duration_days ?? 30,
        startDate: (g as { start_date?: string }).start_date ?? null,
        frequency: (g as { frequency?: "daily" | "weekly" | "specific" }).frequency ?? "daily",
        daysPerWeek: (g as { days_per_week?: number }).days_per_week ?? 7,
      };
    });
    // Preserve membership order (most recently joined first)
    out.sort((a, b) => groupIds.indexOf(a.id) - groupIds.indexOf(b.id));

    return {
      groups: out,
      firstName: (profile?.name ?? "").split(" ")[0] || "there",
      avatarColor: profile?.avatar_color ?? "#22C55E",
      avatarUrl,
      timezone: profile?.timezone ?? "UTC",
    };
  });

/**
 * Creates a group owned by the current user and adds them as a member.
 * Idempotent-ish: if the user already owns a group with the same name we
 * skip creating a duplicate.
 */
export const createGroupForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      emoji: string;
      goal?: string;
      durationDays?: number;
      frequency?: "daily" | "weekly" | "specific";
      daysPerWeek?: number;
    }) => {
      if (!input || typeof input.name !== "string" || typeof input.emoji !== "string") {
        throw new Error("Invalid input");
      }
      const name = input.name.trim().slice(0, 80);
      if (!name) throw new Error("Group name required");
      const id =
        typeof input.id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)
          ? input.id
          : null;
      const goal =
        typeof input.goal === "string" && input.goal.trim().length > 0
          ? input.goal.trim().slice(0, 80)
          : null;
      const durationDays =
        typeof input.durationDays === "number" && input.durationDays > 0
          ? Math.min(365, Math.floor(input.durationDays))
          : 30;
      const frequency: "daily" | "weekly" | "specific" =
        input.frequency === "weekly" || input.frequency === "specific" ? input.frequency : "daily";
      const daysPerWeek =
        typeof input.daysPerWeek === "number" && input.daysPerWeek >= 1 && input.daysPerWeek <= 7
          ? Math.floor(input.daysPerWeek)
          : 7;
      return { id, name, emoji: input.emoji.slice(0, 8) || "🔥", goal, durationDays, frequency, daysPerWeek };
    },
  )

  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = new Date().toISOString().slice(0, 10);
    const { data: group, error: gErr } = await supabaseAdmin
      .from("groups")
      .insert({
        name: data.name,
        emoji: data.emoji,
        goal: data.goal,
        owner_id: userId,
        duration_days: data.durationDays,
        frequency: data.frequency,
        days_per_week: data.daysPerWeek,
        start_date: today,
      } as never)
      .select("id, name, emoji")
      .single();
    if (gErr) throw new Error(gErr.message);

    const { error: mErr } = await supabaseAdmin
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId });
    if (mErr) throw new Error(mErr.message);

    return group;
  });

/**
 * Updates a group's shared commitment (duration, frequency). Owner-only.
 * All members see the same countdown since it's stored on the group.
 */
export const updateGroupCommitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      groupId: string;
      durationDays: number;
      frequency: "daily" | "weekly" | "specific";
      daysPerWeek?: number;
    }) => {
      if (!input?.groupId) throw new Error("Missing group");
      const durationDays = Math.min(365, Math.max(1, Math.floor(input.durationDays)));
      const frequency =
        input.frequency === "weekly" || input.frequency === "specific" ? input.frequency : "daily";
      const daysPerWeek =
        typeof input.daysPerWeek === "number" && input.daysPerWeek >= 1 && input.daysPerWeek <= 7
          ? Math.floor(input.daysPerWeek)
          : 7;
      return { groupId: String(input.groupId), durationDays, frequency, daysPerWeek };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("groups")
      .update({
        duration_days: data.durationDays,
        frequency: data.frequency,
        days_per_week: data.daysPerWeek,
      } as never)
      .eq("id", data.groupId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/**
 * Updates the current user's profile name (called after signup).
 */
export const setMyName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => {
    if (!input || typeof input.name !== "string") throw new Error("Invalid input");
    return { name: input.name.trim().slice(0, 80) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ name: data.name })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Renames a group. Only the owner can rename.
 */
export const renameGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; name: string }) => {
    if (!input || typeof input.groupId !== "string" || typeof input.name !== "string") {
      throw new Error("Invalid input");
    }
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new Error("Group name required");
    return { groupId: input.groupId, name };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("groups")
      .update({ name: data.name })
      .eq("id", data.groupId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Deletes a group. Only the owner can delete. Cascades to members, messages,
 * posts, etc. via ON DELETE CASCADE.
 */
export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    if (!input || typeof input.groupId !== "string" || !input.groupId.trim()) {
      throw new Error("Missing group");
    }
    return { groupId: input.groupId.trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("id", data.groupId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lists group members who haven't yet checked in today (UTC date),
 * excluding the current user if they've already checked in.
 */
export const getPendingCheckIns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ? String(input.groupId) : null,
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    let membership: { group_id: string } | null = null;
    if (data.groupId) {
      const { data: m } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .eq("group_id", data.groupId)
        .maybeSingle();
      membership = m ?? null;
    }
    if (!membership) {
      const { data: m } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      membership = m ? { group_id: m.group_id } : null;
    }

    if (!membership) return { groupId: null, pending: [], iCheckedIn: false };


    const today = localDateFor(await getUserTimezone(supabase, userId));

    const [{ data: members }, { data: checkins }] = await Promise.all([
      supabase.from("group_members").select("user_id").eq("group_id", membership.group_id),
      supabase
        .from("check_ins")
        .select("user_id")
        .eq("group_id", membership.group_id)
        .eq("checkin_date", today),
    ]);

    const checkedInIds = new Set((checkins ?? []).map((c) => c.user_id));
    const memberIds = (members ?? []).map((m) => m.user_id);
    const pendingIds = memberIds.filter((id) => !checkedInIds.has(id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_color, avatar_url")
      .in("id", pendingIds.length ? pendingIds : ["00000000-0000-0000-0000-000000000000"]);

    const pending = await Promise.all(
      (profiles ?? []).map(async (p) => ({
        id: p.id,
        name: p.name,
        avatarColor: p.avatar_color,
        avatarUrl: await signAvatar(supabase, (p as { avatar_url?: string | null }).avatar_url ?? null),
        isMe: p.id === userId,
      })),
    );


    return {
      groupId: membership.group_id,
      pending,
      iCheckedIn: checkedInIds.has(userId),
    };
  });

/**
 * Creates a check-in for the current user in their most recent group for today.
 */
export const createCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { note?: string; photoUrl?: string; mood?: string; activity?: string }) => ({
    note: input?.note?.slice(0, 500) ?? null,
    photoUrl: input?.photoUrl?.slice(0, 2000) ?? null,
    mood: input?.mood?.slice(0, 40) ?? null,
    activity: input?.activity?.slice(0, 40) ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership) throw new Error("You're not in a group yet");

    const today = localDateFor(await getUserTimezone(supabase, userId));

    const { error } = await supabase.from("check_ins").upsert(
      {
        user_id: userId,
        group_id: membership.group_id,
        checkin_date: today,
        note: data.note,
        photo_url: data.photoUrl,
        mood: data.mood,
        activity: data.activity,
      },
      { onConflict: "user_id,group_id,checkin_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type GroupMemberStreak = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  isYou: boolean;
  streak: number;
};

/**
 * Returns each group member's current streak (consecutive days with a
 * check-in or applied streak freeze, ending today or yesterday in the
 * user's timezone).
 */
export const getGroupMemberStreaks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId?: string | null }) => ({
    groupId: input?.groupId ? String(input.groupId) : null,
  }))
  .handler(async ({ context, data }): Promise<{ members: GroupMemberStreak[] }> => {
    const { supabase, userId } = context;

    let groupId = data.groupId;
    if (!groupId) {
      const { data: m } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      groupId = (m?.group_id as string | undefined) ?? null;
    }
    if (!groupId) return { members: [] };

    const tz = await getUserTimezone(supabase, userId);
    const today = localDateFor(tz);
    const yesterday = (() => {
      const [y, mo, d] = today.split("-").map(Number);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      dt.setUTCDate(dt.getUTCDate() - 1);
      return dt.toISOString().slice(0, 10);
    })();

    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, joined_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });
    const memberIds = (members ?? []).map((m) => m.user_id as string);
    if (memberIds.length === 0) return { members: [] };

    const [profRes, ciRes, freezeRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, avatar_color, avatar_url")
        .in("id", memberIds),
      supabase
        .from("check_ins")
        .select("user_id, checkin_date")
        .eq("group_id", groupId)
        .in("user_id", memberIds)
        .lte("checkin_date", today)
        .order("checkin_date", { ascending: false })
        .limit(4000),
      supabase
        .from("streak_freezes_used")
        .select("user_id, freeze_date")
        .eq("group_id", groupId)
        .in("user_id", memberIds)
        .lte("freeze_date", today)
        .limit(4000),
    ]);

    const daysByUser = new Map<string, Set<string>>();
    for (const id of memberIds) daysByUser.set(id, new Set());
    for (const r of ciRes.data ?? []) {
      daysByUser.get(r.user_id as string)?.add(r.checkin_date as string);
    }
    for (const r of freezeRes.data ?? []) {
      daysByUser.get(r.user_id as string)?.add(r.freeze_date as string);
    }

    const computeStreak = (days: Set<string>): number => {
      let streak = 0;
      const start = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
      if (!start) return 0;
      const [y, mo, d] = start.split("-").map(Number);
      const cursor = new Date(Date.UTC(y, mo - 1, d));
      while (true) {
        const iso = cursor.toISOString().slice(0, 10);
        if (days.has(iso)) {
          streak += 1;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else break;
      }
      return streak;
    };

    const profileById = new Map<string, { name: string; avatarColor: string; avatarPath: string | null }>();
    for (const p of profRes.data ?? []) {
      profileById.set(p.id as string, {
        name: ((p.name as string) ?? "").trim() || "Member",
        avatarColor: (p as { avatar_color?: string | null }).avatar_color ?? "#7C3AED",
        avatarPath: (p as { avatar_url?: string | null }).avatar_url ?? null,
      });
    }

    const out: GroupMemberStreak[] = await Promise.all(
      memberIds.map(async (id) => {
        const prof = profileById.get(id);
        return {
          userId: id,
          name: prof?.name ?? "Member",
          avatarUrl: await signAvatar(supabase, prof?.avatarPath ?? null),
          avatarColor: prof?.avatarColor ?? "#7C3AED",
          isYou: id === userId,
          streak: computeStreak(daysByUser.get(id) ?? new Set()),
        };
      }),
    );

    // Sort by streak desc, then name.
    out.sort((a, b) => (b.streak - a.streak) || a.name.localeCompare(b.name));
    return { members: out };
  });
