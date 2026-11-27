import { describe, expect, it } from "vitest";
import { keepVisible, mergeSaved, type SavedRef } from "../saved-posts";

const r = (kind: "post" | "checkin", id: string, savedAt: string): SavedRef => ({ kind, id, savedAt });

describe("Saved › Posts list", () => {
  it("merges posts and check-ins newest saved first", () => {
    const { page } = mergeSaved([r("post", "p1", "2026-11-01T10:00:00Z"), r("post", "p2", "2026-11-03T10:00:00Z")], [r("checkin", "c1", "2026-11-02T10:00:00Z")]);
    expect(page.map((x) => x.id)).toEqual(["p2", "c1", "p1"]);
  });
  it("pages 30 at a time", () => {
    const posts = Array.from({ length: 20 }, (_, i) => r("post", `p${i}`, `2026-11-01T00:${String(i).padStart(2, "0")}:00Z`));
    const cis = Array.from({ length: 15 }, (_, i) => r("checkin", `c${i}`, `2026-11-02T00:${String(i).padStart(2, "0")}:00Z`));
    const { page, more } = mergeSaved(posts, cis);
    expect(page).toHaveLength(30);
    expect(more).toBe(true);
    expect(mergeSaved(posts.slice(0, 5), cis.slice(0, 5)).more).toBe(false);
  });
  it("skips items you can no longer see or that were deleted", () => {
    const refs = [r("post", "p1", "a"), r("checkin", "c1", "b"), r("checkin", "gone", "c")];
    expect(keepVisible(refs, new Set(["post:p1", "checkin:c1"])).map((x) => x.id)).toEqual(["p1", "c1"]);
  });
});
