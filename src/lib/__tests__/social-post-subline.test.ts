import { describe, expect, it } from "vitest";
import { postSubline } from "../social-post-subline";

describe("post header subline", () => {
  it("one crew of the viewer", () => expect(postSubline("crews", [{ name: "FitFam" }], "2h")).toBe("FitFam · 2h"));
  it("more than one crew shows +n", () => expect(postSubline("crews", [{ name: "FitFam" }, { name: "Dawn" }], "2h")).toBe("FitFam +1 · 2h"));
  it("everyone with none of the viewer's crews: just the time", () => expect(postSubline("everyone", [], "2h")).toBe("2h"));
  it("only me", () => expect(postSubline("only_me", [], "2h")).toBe("Only me · 2h"));
});
