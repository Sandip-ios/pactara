import { describe, expect, it } from "vitest";
import { socialCheerLine } from "../social-cheer-line";

describe("self-cheer wording", () => {
  it("includes the owner's cheer once", () => {
    expect(socialCheerLine([], true)).toBe("You cheered");
    expect(socialCheerLine([{ firstName: "Jose", isMe: true }], true)).toBe("You cheered");
  });
  it("includes other reactors alongside the owner", () => {
    expect(socialCheerLine([{ firstName: "Primrose", isMe: false }], true)).toBe("Primrose and you cheered");
  });
  it("removes only the viewer when uncheering", () => {
    expect(socialCheerLine([{ firstName: "Primrose", isMe: false }, { firstName: "Jose", isMe: true }], false)).toBe("Primrose cheered");
    expect(socialCheerLine([{ firstName: "Jose", isMe: true }], false)).toBeNull();
  });
});