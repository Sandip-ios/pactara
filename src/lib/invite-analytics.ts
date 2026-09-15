/**
 * Lightweight invite funnel analytics. Events are written to the console so
 * they show up in native/web logs; swap the sink here if a provider is added.
 */
export type InviteEvent =
  | "invite_link_opened"
  | "invite_resolved"
  | "invite_resolution_already_member"
  | "invite_resolution_join_required"
  | "invite_join_started"
  | "invite_join_completed"
  | "invite_join_already_member"
  | "invite_join_failed"
  | "invite_redirected_to_existing_group"
  | "deferred_deeplink_received";

export type InviteEventProps = {
  group_id?: string | null;
  user_id?: string | null;
  membership_exists?: boolean;
  invite_status?: string | null;
  auth_state?: "authenticated" | "anonymous" | "unknown";
  app_install_state?: "native" | "ios" | "android" | "web";
  source?: string;
  error_code?: string | null;
};

export function trackInvite(event: InviteEvent, props: InviteEventProps = {}) {
  try {
    console.info(`[invite] ${event}`, props);
  } catch {
    // never let analytics break the flow
  }
}
