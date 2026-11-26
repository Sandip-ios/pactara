import { describe, expect, it } from "vitest";
import { checkTipTarget, shouldShowCheckTip } from "@/lib/logger-check-tip";

const ex = [
  { key: "a", sets: [{ id: "a1", done: true }, { id: "a2", done: false }] },
  { key: "b", sets: [{ id: "b1", done: false }] },
];
const base = { loaded: true, seenAt: null, dismissed: false, restRunning: false, exercises: ex };

describe("logger check tip", () => {
  it("shows for an account that never saw it", () => expect(shouldShowCheckTip(base)).toBe(true));
  it("never shows again once the account has seen it", () => expect(shouldShowCheckTip({ ...base, seenAt: "2026-11-26T18:00:00Z" })).toBe(false));
  it("hides after dismissing this session", () => expect(shouldShowCheckTip({ ...base, dismissed: true })).toBe(false));
  it("waits until the saved flag has loaded", () => expect(shouldShowCheckTip({ ...base, loaded: false })).toBe(false));
  it("does not show while rest runs", () => expect(shouldShowCheckTip({ ...base, restRunning: true })).toBe(false));
  it("needs at least one unchecked set", () => expect(shouldShowCheckTip({ ...base, exercises: [{ key: "a", sets: [{ id: "a1", done: true }] }] })).toBe(false));
  it("targets the first unchecked set of the first card", () => expect(checkTipTarget(ex)).toEqual({ exKey: "a", setId: "a2" }));
});
