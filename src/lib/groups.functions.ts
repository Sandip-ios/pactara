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
      .select("id, name, emoji")
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
        .select("name, avatar_color, avatar_url")
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
      };
    }

    const groupIds = memberships.map((m) => m.group_id);
    const { data: groups, error: gErr } = await supabase
      .from("groups")
      .select("id, name, emoji, owner_id, created_at")
      .in("id", groupIds);
    if (gErr) throw new Error(gErr.message);

    const { data: allMembers, error: amErr } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);
    if (amErr) throw new Error(amErr.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_color, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const avatarUrl = await signAvatar(
      supabase,
      (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    );

    const out = (groups ?? []).map((g) => {
      const members = (allMembers ?? []).filter((m) => m.group_id === g.id);
      return {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        isAdmin: g.owner_id === userId,
        memberCount: members.length,
        createdAt: g.created_at,
      };
    });
    // Preserve membership order (most recently joined first)
    out.sort((a, b) => groupIds.indexOf(a.id) - groupIds.indexOf(b.id));

    return {
      groups: out,
      firstName: (profile?.name ?? "").split(" ")[0] || "there",
      avatarColor: profile?.avatar_color ?? "#22C55E",
      avatarUrl,
    };
  });

/**
 * Creates a group owned by the current user and adds them as a member.
 * Idempotent-ish: if the user already owns a group with the same name we
 * skip creating a duplicate.
 */
export const createGroupForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; emoji: string }) => {
    if (!input || typeof input.name !== "string" || typeof input.emoji !== "string") {
      throw new Error("Invalid input");
    }
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new Error("Group name required");
    return { name, emoji: input.emoji.slice(0, 8) || "🔥" };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Use the admin client to bypass RLS — we've already validated the user
    // via requireSupabaseAuth and set owner_id from the verified JWT claims.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: group, error: gErr } = await supabaseAdmin
      .from("groups")
      .insert({ name: data.name, emoji: data.emoji, owner_id: userId })
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
 * Lists group members who haven't yet checked in today (UTC date),
 * excluding the current user if they've already checked in.
 */
export const getPendingCheckIns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
      .select("id, name, avatar_color")
      .in("id", pendingIds.length ? pendingIds : ["00000000-0000-0000-0000-000000000000"]);

    const pending = (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      avatarColor: p.avatar_color,
      isMe: p.id === userId,
    }));

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
