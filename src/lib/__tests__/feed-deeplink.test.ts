import { describe, expect, it } from "vitest";
import { feedUrl, parseFeedDeepLink, withFeedGroup } from "../feed-deeplink";

describe("feed deep links", () => {
  it("adds the notification's group to a feed link", () => {
    expect(withFeedGroup("/home?post=p1&comments=1", "g2")).toBe("/home?group=g2&post=p1&comments=1");
    expect(withFeedGroup("/home", "g2")).toBe("/home?group=g2");
  });

  it("leaves non-feed links alone", () => {
    expect(withFeedGroup("/chat/g1", "g2")).toBe("/chat/g1");
  });

  it("reads the group, post and comments flag back out", () => {
    expect(parseFeedDeepLink(feedUrl({ groupId: "g2", postId: "p1", comments: true }).split("?")[1])).toEqual({
      group: "g2",
      post: "p1",
      comments: true,
    });
    expect(parseFeedDeepLink("?post=p1")).toEqual({ group: undefined, post: "p1", comments: false });
  });
});
