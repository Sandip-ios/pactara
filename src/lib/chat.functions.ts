import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChatPlanCard } from "@/lib/plan-share";
import { visibleTo } from './safety-rules';

export const getUnreadChatCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships, error: mErr } = await supabase
      .from("group_members")
      .select("group_id, last_read_at, groups!inner(ended_at)").is("groups.ended_at", null)
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
    const { blockedPairs } = await import('./safety.server');
    const blocked = await blockedPairs(supabase, userId);

    const { data: group, error: gErr } = await supabase
      .from("groups")
      .select("id, name, emoji").is("ended_at", null)
      .eq("id", data.groupId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!group) throw new Error("Group not found");

    const { data: membership } = await supabase
      .from("group_members")
      .select("id, groups!inner(ended_at)").is("groups.ended_at", null)
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this group");

    const { data: messages, error: mErr } = await supabase
      .from("group_messages")
      .select("id, user_id, body, image_url, created_at, shared_workout_code, shared_plan_slug")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (mErr) throw new Error(mErr.message);

    const messageIds = (messages ?? []).map((m) => m.id);
    const reactionsByMessage: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
    if (messageIds.length > 0) {
      const { data: reacts } = await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds);
      for (const r of reacts ?? []) {
        const list = (reactionsByMessage[r.message_id] ??= []);
        const found = list.find((x) => x.emoji === r.emoji);
        if (found) {
          found.count += 1;
          if (r.user_id === userId) found.mine = true;
        } else {
          list.push({ emoji: r.emoji, count: 1, mine: r.user_id === userId });
        }
      }
    }

    // Workout cards: the shared link's public fields only (name, sets, pictures).
    const shareCodes = (messages ?? []).map((m) => m.shared_workout_code as string | null).filter((c): c is string => !!c);
    const { loadChatWorkoutCards } = await import("@/lib/shared-workouts.server");
    const cards = shareCodes.length ? await loadChatWorkoutCards(shareCodes) : new Map();

    // Plan cards: public plan fields only.
    const planSlugs = [...new Set((messages ?? []).map((m) => m.shared_plan_slug as string | null).filter((s): s is string => !!s))];
    const planCards = new Map<string, ChatPlanCard>();
    if (planSlugs.length) {
      const { data: planRows } = await supabase
        .from("plans")
        .select("slug, name, level, weeks, days_per_week, minutes, cover_url")
        .in("slug", planSlugs)
        .eq("is_published", true);
      for (const p of planRows ?? []) {
        planCards.set(p.slug as string, {
          slug: p.slug as string,
          name: p.name as string,
          level: p.level as string,
          weeks: p.weeks as number,
          daysPerWeek: p.days_per_week as number,
          minutes: p.minutes as string,
          coverUrl: (p.cover_url as string | null) ?? null,
        });
      }
    }

    const { data: memberRows } = await supabase
      .from("group_members")
      .select("user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)
      .eq("group_id", data.groupId)
      .order("joined_at", { ascending: true });
    const memberIds = (memberRows ?? []).map((m) => m.user_id);

    const userIds = Array.from(
      new Set([...(messages ?? []).map((m) => m.user_id), ...memberIds]),
    );
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
                .createSignedUrl(p.avatar_url, 60 * 60, { transform: { width: 192, height: 192, resize: "cover", quality: 75 } });
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
      members: memberIds.map((id) => ({
        id,
        name: profiles[id]?.name ?? "Member",
        avatarColor: profiles[id]?.avatarColor ?? "#7C3AED",
        avatarUrl: profiles[id]?.avatarUrl ?? null,
      })),

      messages: visibleTo(messages ?? [], blocked, m => m.user_id).map((m) => ({
        id: m.id,
        userId: m.user_id,
        body: m.body,
        imageUrl: m.image_url,
        sharedWorkoutCode: (m.shared_workout_code as string | null) ?? null,
        sharedWorkout: m.shared_workout_code ? (cards.get(m.shared_workout_code) ?? null) : null,
        sharedPlanSlug: (m.shared_plan_slug as string | null) ?? null,
        sharedPlan: m.shared_plan_slug ? (planCards.get(m.shared_plan_slug as string) ?? null) : null,
        createdAt: m.created_at,
        authorName: profiles[m.user_id]?.name ?? "User",
        authorColor: profiles[m.user_id]?.avatarColor ?? "#7C3AED",
        authorAvatarUrl: profiles[m.user_id]?.avatarUrl ?? null,
        reactions: reactionsByMessage[m.id] ?? [],
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


export const toggleMessageReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; emoji: string }) => {
    if (!input || typeof input.messageId !== "string" || typeof input.emoji !== "string") {
      throw new Error("Invalid input");
    }
    const emoji = input.emoji.trim().slice(0, 8);
    if (!emoji) throw new Error("Emoji required");
    return { messageId: input.messageId, emoji };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: message, error: messageError } = await supabase.from("group_messages")
      .select("id, groups!inner(ended_at)").eq("id", data.messageId)
      .is("groups.ended_at", null).maybeSingle();
    if (messageError || !message) throw new Error("This crew has ended or is no longer available");
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("id")
      .eq("message_id", data.messageId)
      .eq("user_id", userId)
      .eq("emoji", data.emoji)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("message_reactions").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, added: false };
    }

    const { error } = await supabase.from("message_reactions").insert({
      message_id: data.messageId,
      user_id: userId,
      emoji: data.emoji,
    });
    if (error) throw new Error(error.message);
    return { ok: true, added: true };
  });

/** Delete one of your own chat messages (a shared workout or plan card included). */
export const deleteGroupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string }) => {
    if (!input || typeof input.messageId !== "string") throw new Error("Invalid input");
    return { messageId: input.messageId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Only the message goes: the workout link and anyone's saved copy stay.
    const { data: gone, error } = await supabase
      .from("group_messages")
      .delete()
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!gone?.length) throw new Error("Message not found");
    return { ok: true };
  });
