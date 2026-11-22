import { describe, expect, it } from "vitest";
import { commentMediaKind, commentProblem, commentPush, mediaOnlyCommentLine } from "../comment-media";

describe("comments with only a GIF or photo", () => {
  it("saves a comment with media and no text", () => {
    expect(commentProblem("", "https://media.giphy.com/media/abc/giphy.gif")).toBeNull();
    expect(commentProblem("", "group/user-comment-1.jpg")).toBeNull();
  });
  it("still refuses a comment with neither text nor media", () => {
    expect(commentProblem("", null)).toBe("Comment cannot be empty");
  });
  it("refuses text over 1,000 characters", () => {
    expect(commentProblem("a".repeat(1001), null)).toBe("Comment is too long");
    expect(commentProblem("a".repeat(1000), null)).toBeNull();
  });
  it("reads '{Name} sent a GIF' or '{Name} sent a photo'", () => {
    const gif = commentMediaKind("https://media.giphy.com/media/abc/giphy.gif", "image/gif");
    const photo = commentMediaKind("group/user-comment-1.jpg", "image/jpeg");
    expect(gif).toBe("gif");
    expect(photo).toBe("photo");
    expect(`Guy ${mediaOnlyCommentLine("gif")}`).toBe("Guy sent a GIF");
    expect(`Guy ${mediaOnlyCommentLine("photo")}`).toBe("Guy sent a photo");
  });
  it("titles the push '{Name} sent a GIF' when there are no words", () => {
    expect(commentPush("Guy", "", "gif").title).toBe("Guy sent a GIF");
    expect(commentPush("Guy", "", "photo").title).toBe("Guy sent a photo");
    expect(commentPush("Guy", "Nice one", "gif")).toEqual({ title: "Guy commented", body: "Nice one" });
  });
});
