import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InviteGroupSummary } from "@/lib/invite-resolver";

function validGroupId(input: { groupId: string }) {
  const id = String(input?.groupId ?? "").trim();
  if (!id) throw new Error("Group ID required");
  return { groupId: id };
}

async function loadGroupSummary(groupId: string): Promise<InviteGroupSummary | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: group, error } = await supabaseAdmin
    .from("groups")
    .select("id, name, emoji")
    .eq("id", groupId)
    .maybeSingle();
  // A transient/backend error must NOT be reported as "group no longer active" —
  // throw so the client retries instead of showing a dead-end screen.
  if (error) throw new Error(error.message || "Could not load group");
  if (!group) return null;

  const { count } = await supabaseAdmin
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);

  return {
    id: group.id,
    name: (group.name as string) ?? "this group",
    emoji: (group.emoji as string) ?? "🔥",
    memberCount: count ?? 0,
    active: true,
  };
}

/**
 * Public half of the invite resolver — everything we can know without a
 * signed-in user. Safe to call from the marketing/mobile-web invite page.
 */
export const getInviteGroup = createServerFn({ method: "GET" })
  .inputValidator(validGroupId)
  .handler(async ({ data }) => ({ group: await loadGroupSummary(data.groupId) }));

/**
 * Authenticated half — the source of truth for "does this user still need to
 * join?". Returns membership state, never an error, so a replayed deferred
 * deep link can always be resolved.
 */
export const getInviteContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validGroupId)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const group = await loadGroupSummary(data.groupId);

    const { data: membership } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

    return {
      group,
      isMember: !!membership,
      membershipId: membership?.id ?? null,
      profileComplete: !!(profile?.name ?? "").trim(),
    };
  });
