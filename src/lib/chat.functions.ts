import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUnreadChatCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships, error: mErr } = await supabase
      .from("group_members")
      .select("group_id, last_read_at")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    const list = memberships ?? [];
    if (list.length === 0) return { counts: {} as Record<string, number>, total: 0 };

    const counts: Record<string, number> = {};
    let total = 0;
    await Promise.all(
      list.map(async (m) => {
        const { count } = await supabase
          .from("group_messages")
          .select("id", { count: "exact", head: true })
          .eq("group_id", m.group_id)
          .neq("user_id", userId)
          .gt("created_at", m.last_read_at);
        const n = count ?? 0;
        counts[m.group_id] = n;
        total += n;
      }),
    );
    return { counts, total };
  });

export const markGroupRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    if (!input || typeof input.groupId !== "string") throw new Error("groupId required");
    return { groupId: input.groupId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("group_id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGroupChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    if (!input || typeof input.groupId !== "string") throw new Error("groupId required");
    return { groupId: input.groupId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: group, error: gErr } = await supabase
      .from("groups")
      .select("id, name, emoji")
      .eq("id", data.groupId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!group) throw new Error("Group not found");

    const { data: membership } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this group");

    const { data: messages, error: mErr } = await supabase
      .from("group_messages")
      .select("id, user_id, body, image_url, created_at")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (mErr) throw new Error(mErr.message);

    const userIds = Array.from(new Set((messages ?? []).map((m) => m.user_id)));
    let profiles: Record<string, { name: string; avatarColor: string; avatarUrl: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, avatar_color, avatar_url")
        .in("id", userIds);
      const entries = await Promise.all(
        (profs ?? []).map(
          async (p: { id: string; name: string; avatar_color: string; avatar_url?: string | null }) => {
            let avatarUrl: string | null = null;
            if (p.avatar_url) {
              const { data: signed } = await supabase.storage
                .from("avatars")
                .createSignedUrl(p.avatar_url, 60 * 60);
              avatarUrl = signed?.signedUrl ?? null;
            }
            return [p.id, { name: p.name, avatarColor: p.avatar_color, avatarUrl }] as const;
          },
        ),
      );
      profiles = Object.fromEntries(entries);
    }

    return {
      group,
      currentUserId: userId,
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        body: m.body,
        imageUrl: m.image_url,
        createdAt: m.created_at,
        authorName: profiles[m.user_id]?.name ?? "User",
        authorColor: profiles[m.user_id]?.avatarColor ?? "#7C3AED",
        authorAvatarUrl: profiles[m.user_id]?.avatarUrl ?? null,
      })),
    };

  });

export const sendGroupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; body: string; imageUrl?: string }) => {
    if (!input || typeof input.groupId !== "string") throw new Error("Invalid input");
    const body = (input.body ?? "").trim().slice(0, 2000);
    if (!body && !input.imageUrl) throw new Error("Empty message");
    return { groupId: input.groupId, body, imageUrl: input.imageUrl?.slice(0, 2000) ?? null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("group_messages").insert({
      group_id: data.groupId,
      user_id: userId,
      body: data.body,
      image_url: data.imageUrl,
    });
    if (error) throw new Error(error.message);

    try {
      const { notifyGroupActivity, displayName } = await import("@/lib/notify.server");
      const name = await displayName(userId);
      await notifyGroupActivity(data.groupId, userId, {
        title: name,
        body: data.body || "Sent a photo 📷",
        url: `/chat/${data.groupId}`,
      });
    } catch (err) {
      console.warn("[chat] push failed", err);
    }

    return { ok: true };
  });

