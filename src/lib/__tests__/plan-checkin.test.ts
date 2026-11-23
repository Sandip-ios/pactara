import { beforeEach, describe, expect, it } from "vitest";
import { claimPlanCheckInForLaunch, getPlanCheckIn, setPlanCheckIn } from "../plan-checkin";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const day = { userPlanId: "up1", slug: "build-muscle", planName: "Build Muscle", week: 1, day: 1, activity: "workout" as const };

describe("plan day carried into a check-in", () => {
  it("survives the check-in launch right after Workout done arms it", () => {
    setPlanCheckIn(day);
    claimPlanCheckInForLaunch(1000);
    claimPlanCheckInForLaunch(1200); // the launch effect can run twice
    expect(getPlanCheckIn()).toEqual(day);
  });
  it("is dropped by a later, unrelated check-in", () => {
    setPlanCheckIn(day);
    claimPlanCheckInForLaunch(1000);
    claimPlanCheckInForLaunch(60_000);
    expect(getPlanCheckIn()).toBeNull();
  });
});
