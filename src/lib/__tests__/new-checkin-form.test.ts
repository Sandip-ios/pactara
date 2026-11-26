import { describe, expect, it } from "vitest";
import { canPost, clipLength, defaultCrewSelection, defaultTag, followersChoice, postButtonLabel, restoreCrewSelection, showAlreadyInNote, showCameraAlreadyIn, showTagCard, shouldConfirmClipDiscard } from "../new-checkin-form";

const crews = [
  { id: "a", name: "FitFam", inToday: false },
  { id: "b", name: "Run Club", inToday: true },
  { id: "c", name: "Maya", inToday: false },
];

describe("new check-in form", () => {
  it("confirms leaving an unposted new-version clip", () => expect(shouldConfirmClipDiscard("new", true, false, false)).toBe(true));
  it("never changes classic back navigation", () => expect(shouldConfirmClipDiscard("classic", true, false, false)).toBe(false));
  it("does not block leaving after posting or saving a draft", () => {
    expect(shouldConfirmClipDiscard("new", true, true, false)).toBe(false);
    expect(shouldConfirmClipDiscard("new", true, false, true)).toBe(false);
  });
  it("does not prompt without a clip", () => expect(shouldConfirmClipDiscard("new", false, false, false)).toBe(false));
  it("preselects crews not in yet", () => expect(defaultCrewSelection(crews)).toEqual(["a", "c"]));
  it("restores saved crews that still exist", () => expect(restoreCrewSelection(["b", "x"], crews)).toEqual(["b"]));
  it("labels one crew by name", () => expect(postButtonLabel(["a"], crews, false)).toBe("Check in to FitFam"));
  it("labels several crews by count", () => expect(postButtonLabel(["a", "b"], crews, false)).toBe("Check in to 2 crews"));
  it("shows Posting... while posting", () => expect(postButtonLabel(["a"], crews, true)).toBe("Posting..."));
  it("needs at least one crew", () => { expect(canPost([], false)).toBe(false); expect(canPost(["a"], true)).toBe(false); expect(canPost(["a"], false)).toBe(true); });
  it("already-in note when every selected crew is in", () => expect(showAlreadyInNote(["b"], crews)).toBe(true));
  it("no note once a selected crew is not in yet", () => expect(showAlreadyInNote(["b", "a"], crews)).toBe(false));
  it("no note with nothing selected", () => expect(showAlreadyInNote([], crews)).toBe(false));
  it("camera note only when in for every crew", () => {
    expect(showCameraAlreadyIn(crews)).toBe(false);
    expect(showCameraAlreadyIn(crews.map((c) => ({ ...c, inToday: true })))).toBe(true);
  });
  it("preselects Workout for a logged workout or plan day", () => {
    expect(defaultTag({ workout: true, planDay: false })).toBe("workout");
    expect(defaultTag({ workout: false, planDay: true })).toBe("workout");
    expect(defaultTag({ workout: false, planDay: false })).toBeNull();
  });
  it("hides tags for Health workouts", () => expect(showTagCard(true)).toBe(false));
  it("followers off by default and forced off for under-18", () => {
    expect(followersChoice(undefined, false)).toBe(false);
    expect(followersChoice(true, false)).toBe(true);
    expect(followersChoice(true, true)).toBe(false);
  });
  it("formats clip length", () => expect(clipLength(5.2)).toBe("0:05"));
});
