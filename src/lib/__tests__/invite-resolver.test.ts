import { describe, it, expect } from "vitest";
import { decideInviteResolution, MAX_GROUP_MEMBERS } from "../invite-resolver";

const GROUP_ID = "11111111-1111-1111-1111-111111111111";
const group = (memberCount = 2, active = true) => ({
  id: GROUP_ID,
  name: "Fit Fam",
  emoji: "🔥",
  memberCount,
  active,
});

const base = {
  groupId: GROUP_ID,
  group: group(),
  isAuthenticated: true,
  isMember: false,
  profileComplete: true,
};

describe("decideInviteResolution", () => {
  it("TEST 1/2: signed-in non-member is asked to join", () => {
    expect(decideInviteResolution(base)).toBe("JOIN_REQUIRED");
  });

  it("TEST 3/4: existing member always resolves to the group, never a join CTA", () => {
    expect(decideInviteResolution({ ...base, isMember: true })).toBe("ALREADY_MEMBER");
    // reinstall replay: same invite, membership still exists server-side
    expect(decideInviteResolution({ ...base, isMember: true, group: group(8) })).toBe(
      "ALREADY_MEMBER",
    );
  });

  it("TEST 10: unauthenticated user must sign in first", () => {
    expect(decideInviteResolution({ ...base, isAuthenticated: false })).toBe("AUTH_REQUIRED");
  });

  it("member with an incomplete profile finishes onboarding", () => {
    expect(
      decideInviteResolution({ ...base, isMember: true, profileComplete: false }),
    ).toBe("PROFILE_SETUP_REQUIRED");
  });

  it("TEST 7/8: missing, expired or revoked invites are explicit states", () => {
    expect(decideInviteResolution({ ...base, groupId: null })).toBe("INVITE_INVALID");
    expect(decideInviteResolution({ ...base, groupId: "nope" })).toBe("INVITE_INVALID");
    expect(decideInviteResolution({ ...base, group: null })).toBe("GROUP_UNAVAILABLE");
    expect(decideInviteResolution({ ...base, group: group(2, false) })).toBe("GROUP_UNAVAILABLE");
  });

  it("TEST 9: a full group is explained, not offered", () => {
    expect(decideInviteResolution({ ...base, group: group(MAX_GROUP_MEMBERS) })).toBe("GROUP_FULL");
  });
});
