// Server-only push fan-out helpers. Sends both Web Push (VAPID) and FCM
// (native iOS/Android) to a set of users, honouring their notification
// preferences, and prunes dead subscriptions/tokens.

export type PushPayload = { title: string; body: string; url?: string };

type PrefColumn =
  | "group_activity_enabled"
  | "daily_reminder_enabled"
  | "morning_ritual_reminder_enabled";

/** Filter a list of user ids down to those who opted in to this kind of push. */
export async function filterOptedIn(userIds: string[], pref: PrefColumn): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("notification_preferences")
    .select(`user_id, push_enabled, ${pref}`)
    .in("user_id", userIds);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const byId = new Map(rows.map((r) => [r["user_id"] as string, r]));
  // Users with no preferences row default to enabled.
  return userIds.filter((id) => {
    const row = byId.get(id);
    if (!row) return true;
    return row["push_enabled"] !== false && row[pref] !== false;
  });
}

/** Low-level: push to these users regardless of preferences. */
export async function pushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<{ webSent: number; fcmSent: number }> {
  if (userIds.length === 0) return { webSent: 0, fcmSent: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let webSent = 0;
  let fcmSent = 0;

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
        .select("token")
        .in("user_id", userIds);
      const tokens = ((rows ?? []) as Array<{ token: string }>).map((r) => r.token);
      if (tokens.length > 0) {
        const { sendFcm } = await import("@/lib/fcm.server");
        const result = await sendFcm(tokens, payload);
        fcmSent = result.sent;
        if (result.expired.length > 0) {
          await supabaseAdmin
            .from("fcm_tokens" as never)
            .delete()
            .in("token", result.expired);
        }
      }
    } catch (err) {
      console.warn("[notify] fcm send failed", err);
    }
  }

  return { webSent, fcmSent };
}

/** Push to opted-in users only. */
export async function notifyUsers(
  userIds: string[],
  payload: PushPayload,
  pref: PrefColumn,
): Promise<{ webSent: number; fcmSent: number }> {
  const eligible = await filterOptedIn([...new Set(userIds)], pref);
  return pushToUsers(eligible, payload);
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
      .select("user_id")
      .eq("group_id", groupId);
    const recipients = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id) => id !== actorUserId);
    if (recipients.length === 0) return;
    await notifyUsers(recipients, payload, "group_activity_enabled");
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
