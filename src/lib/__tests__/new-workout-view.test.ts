import { describe, expect, it } from "vitest";
import { doseText, socialLine, tipText, topMuscleChips, workoutButtons, workoutStats } from "@/lib/new-workout-view";

describe("workout page stats", () => {
  it("Back day: 6 exercises, 20 sets, about 50 min", () => {
    const sets = [4, 3, 3, 3, 3, 4].map((s) => ({ sets: s }));
    expect(workoutStats(sets)).toEqual({ exercises: 6, sets: 20, minutes: 50 });
  });
  it("empty workout", () => expect(workoutStats([])).toEqual({ exercises: 0, sets: 0, minutes: 0 }));
});

describe("muscle chips", () => {
  it("top 3 primary muscles by exercise count, ties in first-seen order", () => {
    const items = [{ primary: ["back"] }, { primary: ["back", "biceps"] }, { primary: ["traps"] }, { primary: ["biceps"] }, { primary: ["abs"] }];
    expect(topMuscleChips(items)).toEqual(["Back", "Biceps", "Upper back"]);
  });
  it("counts a muscle once per exercise", () => {
    expect(topMuscleChips([{ primary: ["back", "back"] }, { primary: ["biceps"] }, { primary: ["biceps"] }])).toEqual(["Biceps", "Back"]);
  });
});

describe("sets × reps", () => {
  it("formats reps, each-side reps, seconds and plain sets", () => {
    expect(doseText({ sets: 4, reps: "8" })).toBe("4 × 8");
    expect(doseText({ sets: 3, reps: "10 each" })).toBe("3 × 10 each");
    expect(doseText({ sets: 3, seconds: 30 })).toBe("3 × 30s");
    expect(doseText({ sets: 3 })).toBe("3 sets");
    expect(doseText({ sets: 3, reps: "  " })).toBe("3 sets");
  });
  it("tips trim and cap at 120 characters", () => {
    expect(tipText("  ")).toBeNull();
    expect(tipText("x".repeat(150))?.length).toBe(120);
  });
});

describe("own vs others' buttons", () => {
  it("my own: Edit, menu with delete, no social line", () => {
    expect(workoutButtons({ isMine: true, saved: false, saves: 50, did: 3 })).toEqual({ secondary: "edit", menu: ["edit", "share", "delete"], showSocial: false });
  });
  it("someone else's: Save / Saved, share only", () => {
    expect(workoutButtons({ isMine: false, saved: false })).toEqual({ secondary: "save", menu: ["share"], showSocial: false });
    expect(workoutButtons({ isMine: false, saved: true }).secondary).toBe("saved");
    expect(workoutButtons({ isMine: false, saved: false, saves: 1204, did: 318 }).showSocial).toBe(true);
    expect(socialLine(1204, 318)).toBe("Saved by 1,204 · 318 did it");
  });
});

import { authorDisplayName as _author, topMuscleChips as _chips } from "@/lib/new-workout-view";
describe("detailed muscle chips", () => {
  it("uses detailed tags when present, else primary", () => {
    const back = [
      { primary: ["back"], detail: ["upper back", "lats"] },
      { primary: ["back"], detail: ["lats"] },
      { primary: ["back"], detail: ["upper back", "lats"] },
      { primary: ["back"], detail: ["upper back", "lats"] },
      { primary: ["back"], detail: ["lats"] },
      { primary: ["biceps"], detail: ["biceps"] },
    ];
    expect(_chips(back)).toEqual(["Lats", "Upper back", "Biceps"]);
    expect(_chips([{ primary: ["chest"] }, { primary: ["chest"], detail: [] }])).toEqual(["Chest"]);
  });
});
describe("author name", () => {
  it("full name when public or followed, first name when private and not followed", () => {
    expect(_author({ fullName: "Maya Lindqvist", isPrivate: false, iFollow: false })).toBe("Maya Lindqvist");
    expect(_author({ fullName: "Maya Lindqvist", isPrivate: true, iFollow: true })).toBe("Maya Lindqvist");
    expect(_author({ fullName: "Maya Lindqvist", isPrivate: true, iFollow: false })).toBe("Maya");
  });
});

import { shortDose as _shortDose } from "../new-plan-day-view";
describe("timed dose wording", () => {
  it("plan day 3x30 sec reads 3 × 30s", () => expect(_shortDose("3x30 sec · rest 60 sec")).toBe("3 × 30s"));
  it("plan day reps unchanged", () => expect(_shortDose("3x8-12 · rest 90 sec")).toBe("3 × 8-12"));
});
