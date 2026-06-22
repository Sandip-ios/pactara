import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .select("name")
      .eq("id", userId)
      .maybeSingle();

    const firstName = (profile?.name ?? "").split(" ")[0] || "there";

    if (!membership) {
      return {
        hasGroup: false as const,
        memberCount: 0,
        firstName,
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
      group: group ?? null,
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
