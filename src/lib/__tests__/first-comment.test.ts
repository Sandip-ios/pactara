import { describe, expect, it } from "vitest";
import { firstVisibleComment, type CommentPreview } from "../first-comment";

const early: CommentPreview = { id: "a", userId: "kemi", name: "Kemi", body: "Back day again??", at: "2026-11-27T04:00:00Z" };
const later: CommentPreview = { id: "b", userId: "chris", name: "Chris", body: "Nice work", at: "2026-11-27T04:01:00Z" };
describe("first feed comment", () => {
  it("selects the first chronologically, not the first query row", () => {
    expect(firstVisibleComment([later, early])?.id).toBe("a");
  });
  it("skips blocked users and selects the next comment", () => {
    expect(firstVisibleComment([early, later], new Set(["kemi"]))?.id).toBe("b");
  });
  it("has no preview without comments", () => {
    expect(firstVisibleComment([])).toBeNull();
  });
  it("has no preview when every commenter is blocked", () => {
    expect(firstVisibleComment([early], new Set(["kemi"]))).toBeNull();
  });
});