import { describe, expect, it } from "vitest";
import { adjustRest, fmtElapsed, loggerSubtitle, restSecondsLeft, setRowState, skipRest, uncheckedLine, uncheckedSets } from "./new-workout-logger";

const now = 1_000_000;
const rest = { endsAt: now + 72_000, total: 90, label: "Rest", exKey: "a" };

describe("rest timer", () => {
  it("shows seconds left", () => expect(restSecondsLeft(rest, now)).toBe(72));
  it("+15s adds 15 seconds", () => expect(restSecondsLeft(adjustRest(rest, 15, now), now)).toBe(87));
  it("−15s takes 15 seconds off", () => expect(restSecondsLeft(adjustRest(rest, -15, now), now)).toBe(57));
  it("−15s past zero ends the rest", () => expect(adjustRest({ ...rest, endsAt: now + 10_000 }, -15, now)).toBeNull());
  it("skip clears it", () => expect(skipRest()).toBeNull());
});

describe("set rows", () => {
  it("done row is mint with a green check", () => expect(setRowState({ done: true, pr: false })).toMatchObject({ boxBg: "#DCFCE7", checkBg: "#16A34A", showPr: false }));
  it("open row stays warm gray", () => expect(setRowState({ done: false, pr: false })).toMatchObject({ boxBg: "#F0EDE8", checkBg: "#F0EDE8" }));
  it("PR pill only on a done PR set", () => {
    expect(setRowState({ done: true, pr: true }).showPr).toBe(true);
    expect(setRowState({ done: false, pr: true }).showPr).toBe(false);
  });
});

describe("unchecked sets", () => {
  const s = (done: boolean) => ({ id: "x", weight: 1, reps: 1, seconds: null, done, doneAt: null, pr: false });
  const w = { exercises: [{ sets: [s(true), s(false)] }, { sets: [s(false), s(false)] }] } as never;
  it("counts every unchecked set", () => expect(uncheckedSets(w)).toBe(3));
  it("wording", () => {
    expect(uncheckedLine(3)).toBe("3 sets aren't checked. They won't be saved.");
    expect(uncheckedLine(1)).toBe("1 set isn't checked. It won't be saved.");
  });
});

describe("elapsed", () => {
  it("under an hour", () => expect(fmtElapsed(18 * 60 + 42)).toBe("18:42"));
  it("under ten minutes", () => expect(fmtElapsed(65)).toBe("1:05"));
  it("after an hour", () => expect(fmtElapsed(3600 + 5 * 60 + 9)).toBe("1:05:09"));
  it("subtitle", () => {
    expect(loggerSubtitle("Maya", 1122)).toBe("from Maya · 18:42");
    expect(loggerSubtitle(null, 1122)).toBe("18:42");
  });
});
