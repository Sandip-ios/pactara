import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEFAULT_PACT_LINES = [
  "I'll tell my group what I'm doing each day.",
  "I'll capture proof while I'm doing it, not after.",
  "If I slip, I'll say so instead of going quiet.",
  "I'll show up for the people counting on me.",
];

type PactMember = {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  signed: boolean;
  signedAt: string | null;
  isMe: boolean;
};

/**
 * Everything the pact screen needs: the group's shared promise, who has
 * signed, and whether the current user has signed yet.
 */
export const getPact = createServerFn({ method: "GET" })
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
      .select("id, name, emoji, goal, duration_days, frequency, days_per_week, owner_id, start_date, pact_promise")
      .eq("id", data.groupId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!group) throw new Error("Group not found");

    const { data: members, error: mErr } = await supabaseAdmin
      .from("group_members")
      .select("user_id, joined_at, pact_signed_at, personal_goal")
      .eq("group_id", data.groupId)
      .order("joined_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    const rows = members ?? [];
    if (!rows.some((m) => m.user_id === userId)) {
      throw new Error("You're not a member of this group");
    }

    const ids = rows.map((m) => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, avatar_color, avatar_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    const list: PactMember[] = await Promise.all(
      rows.map(async (m) => {
        const p = byId.get(m.user_id) as
          | { name?: string | null; avatar_color?: string | null; avatar_url?: string | null }
          | undefined;
        let url: string | null = null;
        if (p?.avatar_url) {
          const { data: s } = await supabaseAdmin.storage
            .from("avatars")
            .createSignedUrl(p.avatar_url, 60 * 60);
          url = s?.signedUrl ?? null;
        }
        const signedAt = (m as { pact_signed_at?: string | null }).pact_signed_at ?? null;
        return {
          id: m.user_id,
          name: (p?.name ?? "").split(" ")[0] || "Member",
          avatarColor: p?.avatar_color ?? "#7C3AED",
          avatarUrl: url,
          signed: Boolean(signedAt),
          signedAt,
          isMe: m.user_id === userId,
        };
      }),
    );

    const me = list.find((m) => m.isMe) ?? null;

    return {
      groupId: group.id as string,
      name: group.name as string,
      emoji: (group.emoji as string) ?? "🔥",
      goal: ((rows.find((m) => m.user_id === userId) as { personal_goal?: string | null } | undefined)
        ?.personal_goal ?? null) as string | null,
      durationDays: ((group as { duration_days?: number | null }).duration_days ?? 30) as number,
      frequency: ((group as { frequency?: string | null }).frequency ?? "daily") as string,
      daysPerWeek: ((group as { days_per_week?: number | null }).days_per_week ?? 7) as number,
      startDate: ((group as { start_date?: string | null }).start_date ?? null) as string | null,
      promise: ((group as { pact_promise?: string | null }).pact_promise ?? null) as string | null,
      isOwner: group.owner_id === userId,
      hasSigned: Boolean(me?.signed),
      signedCount: list.filter((m) => m.signed).length,
      memberCount: list.length,
      members: list,
    };
  });

/** Records the current user's signature on the group pact. Idempotent. */
export const signPact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    const id = String(input?.groupId ?? "").trim();
    if (!id) throw new Error("Group ID required");
    return { groupId: id };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("group_members")
      .select("id, pact_signed_at")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("You're not a member of this group");

    const signedAt = (row as { pact_signed_at?: string | null }).pact_signed_at;
    if (signedAt) return { ok: true, signedAt };

    const now = new Date().toISOString();
    const { error: uErr } = await supabaseAdmin
      .from("group_members")
      .update({ pact_signed_at: now } as never)
      .eq("id", row.id);
    if (uErr) throw new Error(uErr.message);

    // Tell the rest of the group — and celebrate once everyone is in.
    try {
      const [{ data: members }, { data: group }] = await Promise.all([
        supabaseAdmin
          .from("group_members")
          .select("user_id, pact_signed_at")
          .eq("group_id", data.groupId),
        supabaseAdmin.from("groups").select("name").eq("id", data.groupId).maybeSingle(),
      ]);
      const rows2 = (members ?? []) as Array<{ user_id: string; pact_signed_at: string | null }>;
      const others = rows2.map((m) => m.user_id).filter((id) => id !== userId);
      const groupName = (group?.name as string) ?? "your group";
      const everyoneIn = rows2.length > 1 && rows2.every((m) => Boolean(m.pact_signed_at));

      if (others.length > 0) {
        const { notifyUsers, displayName } = await import("@/lib/notify.server");
        const name = await displayName(userId);
        await notifyUsers(
          others,
          {
            title: `${name} made the pact`,
            body: everyoneIn
              ? `Everyone's in on ${groupName}. Time to show up.`
              : `${name} is in on ${groupName}.`,
            url: `/groups/${data.groupId}`,
          },
          "group_activity_enabled",
        );
      }
    } catch (err) {
      console.warn("[pact] sign notification failed", err);
    }

    return { ok: true, signedAt: now };
  });

/**
 * First group the current user still needs to sign the pact for.
 * Used to gate the app until every existing member has signed.
 */
export const getPendingPact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("group_members")
      .select("group_id, joined_at, pact_signed_at")
      .eq("user_id", userId)
      .is("pact_signed_at", null)
      .order("joined_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);

    const row = (data ?? [])[0];
    return { groupId: row ? (row.group_id as string) : null };
  });
