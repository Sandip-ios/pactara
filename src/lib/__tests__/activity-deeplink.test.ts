import { describe, expect, it } from "vitest";
import { activityOpenUrl, crewPostUrl, inferredReminderActivityUrl, pushUrlForVersion, withActivityGroup, withActivityReturn } from "../activity-deeplink";

describe("new-version Activity deep links", () => {
  it("targets the exact post and comment in the crew Posts tab", () => {
    expect(crewPostUrl({ groupId: "g1", postId: "p1", commentId: "c1", fromActivity: true }))
      .toBe("/crews/g1?crewTab=posts&post=p1&comments=1&comment=c1&from=activity");
    expect(crewPostUrl({ groupId: "g1", postId: "p1" }))
      .toBe("/crews/g1?crewTab=posts&post=p1");
  });

  it("round-trips every target through one push/row resolver URL", () => {
    const url = activityOpenUrl({ kind: "comment_like", groupId: "g1", postId: "p1", commentId: "c1", actorId: "a1", requestId: "r1" });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(url.startsWith("/activity/open?")).toBe(true);
    expect(Object.fromEntries(params)).toEqual({ kind: "comment_like", group: "g1", post: "p1", comment: "c1", actor: "a1", request: "r1" });
  });

  it("adds the crew to a post push without changing its exact comment", () => {
    const url = withActivityGroup(activityOpenUrl({ kind: "reply", postId: "p1", commentId: "c1" }), "g1")!;
    const params = new URL(url, "https://pactara.lovable.app").searchParams;
    expect(Object.fromEntries(params)).toEqual({ kind: "reply", group: "g1", post: "p1", comment: "c1" });
  });

  it("adds Activity return state only to crew destinations", () => {
    expect(withActivityReturn("/crews/g1?crewTab=posts&post=p1")).toContain("from=activity");
    expect(withActivityReturn("/u/a1")).toBe("/u/a1");
  });

  it("changes only the new-version push destination", () => {
    expect(pushUrlForVersion("/home?post=p1", "/activity/open?kind=checkin&post=p1", false)).toBe("/home?post=p1");
    expect(pushUrlForVersion("/home?post=p1", "/activity/open?kind=checkin&post=p1", true)).toBe("/activity/open?kind=checkin&post=p1");
    expect(pushUrlForVersion("/chat/g1", undefined, true)).toBe("/chat/g1");
  });

  it("keeps classic reminder URLs while giving new recipients the resolver", () => {
    expect(inferredReminderActivityUrl("/check-in?group=g1")).toBe(activityOpenUrl({ kind: "reminder", groupId: "g1" }));
    expect(inferredReminderActivityUrl("/home?post=p1")).toBeUndefined();
  });
});
