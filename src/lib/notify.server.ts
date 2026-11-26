// Server-only push fan-out helpers. Sends both Web Push (VAPID) and FCM
// (native iOS/Android) to a set of users, honouring their notification
// preferences, and prunes dead subscriptions/tokens.

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  /** Native (FCM) only: sender photo, thumbnail and crew thread for rich check-in pushes. */
  sender?: { id: string; name: string; avatarUrl: string | null };
  imageUrl?: string | null;
  threadId?: string | null;
  /** Internal only, never included in notification copy. */
  actorUserId?: string;
  /** Internal destinations, rechecked immediately before sending a crew reminder. */
  crewIds?: string[];
};

type PrefColumn =
  | "group_activity_enabled"
  | "daily_reminder_enabled"
  | "morning_ritual_reminder_enabled"
  | "workout_start_enabled"
  | "workout_complete_enabled"
  | "nudges_enabled"
  | "group_milestones_enabled";

/** Filter a list of user ids down to those who opted in to this kind of push. */
export async function filterOptedIn(
  userIds: string[],
  pref: PrefColumn,
  defaultEnabled = true,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("notification_preferences")
    .select(`user_id, push_enabled, ${pref}`)
    .in("user_id", userIds);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const byId = new Map(rows.map((r) => [r["user_id"] as string, r]));
  return userIds.filter((id) => {
    const row = byId.get(id);
    // No preferences row yet — fall back to this notification's default.
    if (!row) return defaultEnabled;
    if (row["push_enabled"] === false) return false;
    const value = row[pref];
    return value === undefined || value === null ? defaultEnabled : value !== false;
  });
}

/** Low-level: push to these users regardless of preferences. */
export async function pushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<{ webSent: number; fcmSent: number }> {
  if (userIds.length === 0) return { webSent: 0, fcmSent: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const destination = new URL(payload.url ?? "/home", "https://pactara.lovable.app");
  const groupId = payload.threadId ?? destination.searchParams.get("group") ?? destination.pathname.match(/^\/(?:chat|groups|crews|pact)\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];
  const crewIds = [...new Set([...(payload.crewIds ?? []), ...(groupId ? [groupId] : [])])];
  if (crewIds.length) {
    const { data: crews, error } = await supabaseAdmin.from("groups").select("id").in("id", crewIds).is("ended_at", null);
    if (error || crews?.length !== crewIds.length) return { webSent: 0, fcmSent: 0 };
  }

  let webSent = 0;
  let fcmSent = 0;
  const actorId = payload.actorUserId ?? payload.sender?.id;
  if (actorId) {
    const { blockedPairs } = await import('./safety.server');
    const blocked = await blockedPairs(supabaseAdmin, actorId);
    userIds = userIds.filter(id => !blocked.has(id));
    if (!userIds.length) return { webSent: 0, fcmSent: 0 };
  }

  // --- Web Push -------------------------------------------------------------
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    try {
      const { default: webpush } = await import("web-push");
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:reminders@pactara.lovable.app",
        publicKey,
        privateKey,
      );
      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions" as never)
        .select("id, endpoint, p256dh, auth")
        .in("user_id", userIds);

      const body = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/home",
        ...(actorId ? { actor_id: actorId } : {}),
      });
      const expired: string[] = [];
      for (const s of (subs ?? []) as Array<{
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }>) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
          webSent++;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) expired.push(s.id);
        }
      }
      if (expired.length > 0) {
        await supabaseAdmin
          .from("push_subscriptions" as never)
          .delete()
          .in("id", expired);
      }
    } catch (err) {
      console.warn("[notify] web push failed", err);
    }
  }

  // --- FCM ------------------------------------------------------------------
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const { data: rows } = await supabaseAdmin
        .from("fcm_tokens" as never)
        .select("token, user_id")
        .in("user_id", userIds);
      const tokenRows = (rows ?? []) as Array<{ token: string; user_id: string }>;
      const tokens = tokenRows.map((r) => r.token);
      if (tokens.length > 0) {
        // Bump each recipient's app-icon badge and attach the new total.
        const badgeByToken: Record<string, number> = {};
        try {
          const { data: counts } = await supabaseAdmin.rpc("increment_badge_counts" as never, {
            _user_ids: userIds,
          } as never);
          const byUser = new Map(
            ((counts ?? []) as Array<{ user_id: string; count: number }>).map((c) => [
              c.user_id,
              c.count,
            ]),
          );
          for (const r of tokenRows) {
            const n = byUser.get(r.user_id);
            if (typeof n === "number") badgeByToken[r.token] = n;
          }
        } catch (err) {
          console.warn("[notify] badge increment failed", err);
        }

        const { sendFcm } = await import("@/lib/fcm.server");
        const result = await sendFcm(tokens, payload, badgeByToken);
        fcmSent = result.sent;
        if (result.expired.length > 0) {
          await supabaseAdmin
            .from("fcm_tokens" as never)
            .delete()
            .in("token", result.expired);
        }
      }
    } catch (err) {
      console.error("[notify] fcm send failed", (err as Error)?.message ?? err);
    }
  }

  console.info("[notify] delivery complete", {
    recipients: userIds.length,
    webSent,
    fcmSent,
    destination: payload.url ?? "/home",
  });

  return { webSent, fcmSent };
}

/** Push to opted-in users only. */
export async function notifyUsers(
  userIds: string[],
  payload: PushPayload,
  pref: PrefColumn,
  defaultEnabled = true,
): Promise<{ webSent: number; fcmSent: number }> {
  const eligible = await filterOptedIn([...new Set(userIds)], pref, defaultEnabled);
  return pushToUsers(eligible, payload);
}

/**
 * Tell the rest of a group that someone started or finished a workout.
 * Workout-complete pushes are opt-in, so they default off for users who have
 * never touched their notification settings.
 */
export async function notifyGroupWorkout(
  groupId: string,
  actorUserId: string,
  payload: PushPayload,
  pref: "workout_start_enabled" | "workout_complete_enabled",
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("user_id, groups!inner(ended_at)").is("groups.ended_at", null)
      .eq("group_id", groupId);
    const recipients = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id) => id !== actorUserId);
    if (recipients.length === 0) return;
    await notifyUsers(recipients, { ...payload, actorUserId }, pref, pref === "workout_start_enabled");
  } catch (err) {
    console.warn("[notify] workout push failed", err);
  }
}

/**
 * Notify every member of a group except the actor about group activity.
 * Never throws — notification failures must not break the user action.
 */
export async function notifyGroupActivity(
  groupId: string,
  actorUserId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("user_id, groups!inner(ended_at)").is("groups.ended_at", null)
      .eq("group_id", groupId);
    const recipients = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id) => id !== actorUserId);
    if (recipients.length === 0) return;
    const { withFeedGroup } = await import("@/lib/feed-deeplink");
    await notifyUsers(
      recipients,
      { ...payload, actorUserId, url: withFeedGroup(payload.url ?? "/home", groupId) },
      "group_activity_enabled",
    );
  } catch (err) {
    console.warn("[notify] group activity failed", err);
  }
}

/** Display name for a user, falling back to a generic label. */
export async function displayName(userId: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    const name = (data?.name ?? "").trim();
    return name || "Someone";
  } catch {
    return "Someone";
  }
}

/**
 * Notify the author of a daily post about a reaction or comment on it.
 * No-op when the actor is the author. Never throws.
 */
export async function notifyPostAuthor(
  postId: string,
  actorUserId: string,
  build: (actorName: string) => PushPayload,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin
      .from("daily_posts")
      .select("user_id, group_id, groups!inner(ended_at)").is("groups.ended_at", null)
      .eq("id", postId)
      .maybeSingle();
    const authorId = post?.user_id as string | undefined;
    if (!authorId || authorId === actorUserId) return;
    const name = await displayName(actorUserId);
    const payload = build(name);
    const { withFeedGroup } = await import("@/lib/feed-deeplink");
    await notifyUsers(
      [authorId],
      { ...payload, actorUserId, url: withFeedGroup(payload.url ?? "/home", post?.group_id as string | undefined) },
      "group_activity_enabled",
    );
  } catch (err) {
    console.warn("[notify] post author push failed", err);
  }
}

/**
 * Notify everyone involved in a post's comment thread (post author + prior
 * commenters), excluding the actor. Never throws.
 */
export async function notifyPostComment(
  postId: string,
  actorUserId: string,
  build: (actorName: string) => PushPayload,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: post }, { data: commenters }] = await Promise.all([
      supabaseAdmin.from("daily_posts").select("user_id, group_id, groups!inner(ended_at)").is("groups.ended_at", null).eq("id", postId).maybeSingle(),
      supabaseAdmin.from("post_comments").select("user_id").eq("post_id", postId),
    ]);
    if (!post) return;
    const ids = new Set<string>();
    const authorId = post?.user_id as string | undefined;
    if (authorId) ids.add(authorId);
    for (const c of (commenters ?? []) as Array<{ user_id: string }>) ids.add(c.user_id);
    ids.delete(actorUserId);
    const recipients = Array.from(ids);
    if (recipients.length === 0) return;
    const name = await displayName(actorUserId);
    const payload = build(name);
    const { withFeedGroup } = await import("@/lib/feed-deeplink");
    await notifyUsers(
      recipients,
      { ...payload, actorUserId, url: withFeedGroup(payload.url ?? "/home", post?.group_id as string | undefined) },
      "group_activity_enabled",
    );
  } catch (err) {
    console.warn("[notify] post comment push failed", err);
  }
}
