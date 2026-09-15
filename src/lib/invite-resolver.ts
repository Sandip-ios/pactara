/**
 * Central invite resolution logic.
 *
 * An invite link is a doorway to a group — it is NOT proof that the user still
 * needs to join. Every invite resolves against the user's current server-side
 * membership state, so replayed/deferred deep links (e.g. after an app
 * reinstall) never strand an existing member on a dead "Join" button.
 */

export const MAX_GROUP_MEMBERS = 8;

export type InviteResolution =
  | "JOIN_REQUIRED"
  | "ALREADY_MEMBER"
  | "AUTH_REQUIRED"
  | "PROFILE_SETUP_REQUIRED"
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "GROUP_FULL"
  | "GROUP_UNAVAILABLE";

export type InviteGroupSummary = {
  id: string;
  name: string;
  emoji: string;
  memberCount: number;
  active: boolean;
};

export type InviteResolverInput = {
  groupId: string | null | undefined;
  /** null when the group could not be found (invalid/revoked invite). */
  group: InviteGroupSummary | null;
  isAuthenticated: boolean;
  isMember: boolean;
  profileComplete: boolean;
};

const UUID = /^[0-9a-fA-F-]{36}$/;

export function decideInviteResolution(input: InviteResolverInput): InviteResolution {
  const { groupId, group, isAuthenticated, isMember, profileComplete } = input;

  if (!groupId || !UUID.test(groupId)) return "INVITE_INVALID";
  if (!group) return "GROUP_UNAVAILABLE";
  if (!group.active) return "GROUP_UNAVAILABLE";

  // Membership is the source of truth — check it before anything about the
  // invite itself (including capacity).
  if (isAuthenticated && isMember) {
    return profileComplete ? "ALREADY_MEMBER" : "PROFILE_SETUP_REQUIRED";
  }

  if (!isAuthenticated) return "AUTH_REQUIRED";
  if (group.memberCount >= MAX_GROUP_MEMBERS) return "GROUP_FULL";
  if (!profileComplete) return "PROFILE_SETUP_REQUIRED";
  return "JOIN_REQUIRED";
}
