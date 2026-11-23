import { describe, expect, it } from "vitest";
import { bestSetLabel, fmtLiftTime, liftChange30, liftsToggleLabel, recentDate, recentMeta, sessionKicker, weekStats, type DatedSet } from "@/lib/workouts-tab";
import { latestLeftRun, planStartAction, planWorkoutsDone } from "@/lib/workout-plans";
import { toastBottomFor } from "@/lib/toast-offset";

const lb = (weight: number | null, reps: number, localDate: string): DatedSet => ({ weight, reps, seconds: null, unit: "lb", localDate });

describe("this week tiles", () => {
  // Sun Nov 22 2026; the member's week started Mon Nov 16.
  const today = "2026-11-22";
  it("counts only workouts logged Monday through today", () => {
    const s = weekStats(
      [
        { localDate: "2026-11-15", minutes: 50, prs: 2 }, // last Sunday
        { localDate: "2026-11-16", minutes: 40, prs: 1 },
        { localDate: "2026-11-19", minutes: 39, prs: 0 },
        { localDate: "2026-11-22", minutes: 34, prs: 2 },
      ],
      today,
    );
    expect(s).toEqual({ workouts: 3, minutes: 113, prs: 3 });
  });
  it("formats time lifting as 1h 53m", () => {
    expect(fmtLiftTime(113)).toBe("1h 53m");
    expect(fmtLiftTime(34)).toBe("34m");
    expect(fmtLiftTime(120)).toBe("2h");
  });
});

describe("recent rows", () => {
  it("shows exercises, sets and minutes for a regular workout", () => {
    expect(recentMeta({ exercises: 4, sets: 11, minutes: 34, plan: null })).toBe("4 exercises · 11 sets · 34 min");
    expect(recentMeta({ exercises: 1, sets: 1, minutes: 5, plan: null })).toBe("1 exercise · 1 set · 5 min");
  });
  it("shows the plan and week for a plan day", () => {
    expect(recentMeta({ exercises: 5, sets: 15, minutes: 41, plan: { name: "Build Muscle", week: 3 } })).toBe("Build Muscle · week 3 · 41 min");
  });
  it("dates rows and the sheet by the member's local date", () => {
    expect(recentDate("2026-11-22")).toEqual({ weekday: "SUN", day: "22" });
    expect(sessionKicker("2026-11-22", 34)).toBe("SUNDAY, NOV 22 · 34 MIN");
  });
});

describe("your lifts", () => {
  const today = "2026-11-22";
  it("best set reads 55 lb × 8, or 22 reps for bodyweight", () => {
    expect(bestSetLabel([lb(50, 10, today), lb(55, 8, today)], "lb", "reps")).toBe("55 lb × 8");
    expect(bestSetLabel([lb(null, 18, today), lb(null, 22, today)], "lb", "reps")).toBe("22 reps");
  });
  it("+10 lb when the best set got heavier in the last 30 days", () => {
    expect(liftChange30([lb(45, 8, "2026-10-01"), lb(55, 8, "2026-11-20")], today, "lb", "reps")).toBe("+10 lb");
  });
  it("+4 reps for a bodyweight move", () => {
    expect(liftChange30([lb(null, 18, "2026-10-01"), lb(null, 22, "2026-11-20")], today, "lb", "reps")).toBe("+4 reps");
  });
  it("compares with the first day logged when the lift is newer than 30 days", () => {
    expect(liftChange30([lb(40, 8, "2026-11-02"), lb(50, 8, "2026-11-20")], today, "lb", "reps")).toBe("+10 lb");
  });
  it("hidden when nothing changed or only one day is logged", () => {
    expect(liftChange30([lb(55, 8, "2026-10-01"), lb(50, 8, "2026-11-20")], today, "lb", "reps")).toBeNull();
    expect(liftChange30([lb(55, 8, "2026-11-20")], today, "lb", "reps")).toBeNull();
    expect(liftChange30([lb(55, 8, "2026-09-01")], today, "lb", "reps")).toBeNull();
  });
  it("shows 3, then all", () => {
    expect(liftsToggleLabel(12, false)).toBe("Show all 12 lifts");
    expect(liftsToggleLabel(12, true)).toBe("Show fewer");
  });
});

describe("leaving and switching plans", () => {
  it("Pick up resumes the run you left most recently", () => {
    const rows = [
      { id: "old", planId: "a", status: "stopped" as const, updatedAt: "2026-10-01T00:00:00Z" },
      { id: "new", planId: "a", status: "stopped" as const, updatedAt: "2026-11-20T00:00:00Z" },
    ];
    expect(latestLeftRun(rows, "a")?.id).toBe("new");
    expect(planStartAction(rows, "a").resumeId).toBe("new");
  });
  it("Start over from week 1 starts a fresh run instead of resuming", () => {
    const rows = [{ id: "left", planId: "a", status: "stopped" as const }];
    expect(planStartAction(rows, "a", { fresh: true })).toEqual({ alreadyActiveId: null, stopIds: [], resumeId: null });
  });
  it("switching stops the current plan (only one active at a time)", () => {
    const rows = [
      { id: "bm", planId: "build", status: "active" as const },
      { id: "lf", planId: "lose", status: "stopped" as const },
    ];
    expect(planStartAction(rows, "lose")).toEqual({ alreadyActiveId: null, stopIds: ["bm"], resumeId: "lf" });
  });
  it("counts each plan day once, even when posted to several crews", () => {
    expect(planWorkoutsDone([{ week: 1, day_number: 1 }, { week: 1, day_number: 1 }, { week: 1, day_number: 2 }, { week: 2, day_number: 1 }])).toBe(3);
  });
});

describe("toasts sit above the bottom bar", () => {
  it("bar height + 12px", () => {
    expect(toastBottomFor([83])).toBe(95);
    expect(toastBottomFor([83, 131])).toBe(143);
    expect(toastBottomFor([])).toBeNull();
  });
});

import { leftRunHasProgress } from "@/lib/workout-plans";
import { planForUntaggedSession, type PlanRunForHistory } from "@/lib/workouts-tab";

describe("plan page after leaving", () => {
  it("week 1, day 1, nothing logged: no progress, so a single Start this plan again", () => {
    expect(leftRunHasProgress({ currentWeek: 1, nextDay: 1, workoutsDone: 0 })).toBe(false);
  });
  it("past week 1 day 1: Pick up and Start over both show", () => {
    expect(leftRunHasProgress({ currentWeek: 1, nextDay: 2, workoutsDone: 1 })).toBe(true);
    expect(leftRunHasProgress({ currentWeek: 3, nextDay: 1, workoutsDone: 7 })).toBe(true);
  });
});

describe("Recent: plan meta for a plan day that was never posted", () => {
  const buildMuscle: PlanRunForHistory = {
    name: "Build Muscle",
    startedAt: "2026-11-23T01:08:42.545326+00:00",
    currentWeek: 1,
    dayTitles: ["Push: chest + shoulders", "Pull: back + biceps"],
    lastLogAt: null,
  };
  const session = { title: "Push: chest + shoulders", loggedAt: "2026-11-23T02:43:24.269+00:00" };

  it("matches the plan day title in a run that had started", () => {
    expect(planForUntaggedSession(session, [buildMuscle])).toEqual({ name: "Build Muscle", week: 1 });
  });
  it("ignores a run started after the workout (a later Start over)", () => {
    expect(planForUntaggedSession(session, [{ ...buildMuscle, startedAt: "2026-11-23T04:02:45+00:00" }])).toBeNull();
  });
  it("skips a run that logged a day since, because its week may have moved", () => {
    expect(planForUntaggedSession(session, [{ ...buildMuscle, lastLogAt: "2026-11-24T12:00:00+00:00" }])).toBeNull();
  });
  it("a workout with a name that isn't a plan day stays a normal workout", () => {
    expect(planForUntaggedSession({ ...session, title: "Chest day" }, [buildMuscle])).toBeNull();
  });
});
