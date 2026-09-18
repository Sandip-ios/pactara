import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const GOAL_MAX = 120;

export const GOAL_SUGGESTIONS = [
  { emoji: "💪", label: "Lose 10 pounds" },
  { emoji: "🏋️", label: "Build muscle" },
  { emoji: "🏃", label: "Run a 5K" },
  { emoji: "🥗", label: "Eat 3 healthy meals a day" },
];

/** The current user's personal goal inside one group, plus group basics. */
export const getMemberGoal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    const id = String(input?.groupId ?? "").trim();
    if (!id) throw new Error("Group ID required");
    return { groupId: id };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: member, error: mErr }, { data: group }] = await Promise.all([
      supabaseAdmin
        .from("group_members")
        .select("id, personal_goal")
        .eq("group_id", data.groupId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin.from("groups").select("id, name, emoji").eq("id", data.groupId).maybeSingle(),
    ]);
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("You're not a member of this group");

    return {
      groupId: data.groupId,
      groupName: (group?.name as string) ?? "your group",
      emoji: (group?.emoji as string) ?? "🔥",
      goal: ((member as { personal_goal?: string | null }).personal_goal ?? null) as string | null,
    };
  });

/** Saves (or updates) the current user's personal goal for a group. */
export const setMemberGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; goal: string }) => {
    const id = String(input?.groupId ?? "").trim();
    const goal = String(input?.goal ?? "").trim().slice(0, GOAL_MAX);
    if (!id) throw new Error("Group ID required");
    if (!goal) throw new Error("Write your goal first");
    return { groupId: id, goal };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("You're not a member of this group");

    const { error: uErr } = await supabaseAdmin
      .from("group_members")
      .update({ personal_goal: data.goal, personal_goal_set_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, goal: data.goal };
  });

/**
 * First group the current user has joined without writing a personal goal.
 * Used to gate the app the same way the pact does.
 */
export const getPendingGoal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("group_members")
      .select("group_id, joined_at, personal_goal")
      .eq("user_id", userId)
      .is("personal_goal", null)
      .order("joined_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);

    const row = (data ?? [])[0];
    return { groupId: row ? (row.group_id as string) : null };
  });
