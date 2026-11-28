import { describe, expect, it } from "vitest";
import { checkInSocialFor } from "../checkin-social";
import { cheeredByLine } from "../redesign-feed-view";

const first = "11111111-1111-1111-1111-111111111111";
const later = "22222222-2222-2222-2222-222222222222";
const primrose = { checkInId: null, userId: "primrose" };
const viewer = { checkInId: later, userId: "viewer" };

function line(reactors: { userId: string }[]) {
  return cheeredByLine(reactors.map((r) => ({
    firstName: r.userId === "primrose" ? "Primrose" : "Viewer",
    isMe: r.userId === "viewer",
  })));
}

describe("shared Home and Crew check-in social selection", () => {
  it("gives both surfaces the same legacy cheer line and comment count", () => {
    const reactions = [primrose, { ...primrose, emoji: "💪" }];
    const comments = [{ checkInId: null }, { checkInId: first }];
    const home = checkInSocialFor(first, first, reactions, comments);
    const crew = checkInSocialFor(first, first, reactions, comments);
    expect(home.reactors.map((r) => r.userId)).toEqual(["primrose"]);
    expect(line(home.reactors)).toBe("Primrose cheered");
    expect(line(crew.reactors)).toBe(line(home.reactors));
    expect(crew.commentCount).toBe(home.commentCount);
    expect(home.commentCount).toBe(2);
  });

  it("keeps legacy rows off a later check-in while retaining its own cheer", () => {
    const social = checkInSocialFor(later, first, [primrose, viewer], [{ checkInId: null }, { checkInId: later }]);
    expect(social.reactors.map((r) => r.userId)).toEqual(["viewer"]);
    expect(line(social.reactors)).toBe("You cheered");
    expect(social.commentCount).toBe(1);
  });

  it("does not copy one crew's social rows onto another crew's check-in", () => {
    const crewA = checkInSocialFor(first, first, [primrose], [{ checkInId: null }]);
    const crewB = checkInSocialFor(first, first, [], []);
    expect(line(crewA.reactors)).toBe("Primrose cheered");
    expect(crewA.commentCount).toBe(1);
    expect(crewB.reactors).toEqual([]);
    expect(crewB.commentCount).toBe(0);
    expect(line(crewB.reactors)).toBeNull();
  });

  it("uses the established multi-person cheer wording", () => {
    const social = checkInSocialFor(first, first, [
      primrose,
      { checkInId: first, userId: "maya" },
      { checkInId: first, userId: "viewer" },
    ], []);
    expect(social.reactors).toHaveLength(3);
    expect(cheeredByLine(social.reactors.map((r) => ({ firstName: r.userId, isMe: r.userId === "viewer" })))).toBe("primrose, maya +1 cheered");
  });
});
