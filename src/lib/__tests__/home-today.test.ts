import { describe, expect, it } from "vitest";
import { selectTodayState, type TodayCrewInput, type TodayPlanInput } from "@/lib/home-today";

const crew = (id: string, checkedIn = false, cover: "rest" | "freeze" | null = null): TodayCrewInput => ({
  id,
  name: id,
  checkedIn,
  cover,
  checkedInCount: checkedIn ? 2 : 1,
  dueCount: 4,
});
const plan = (status: TodayPlanInput["status"]): TodayPlanInput => ({
  slug: "build-muscle",
  name: "Build Muscle",
  week: 2,
  day: 3,
  title: "Push",
  minutes: "35",
  coverUrl: null,
  status,
  elapsedMinutes: status === "in_progress" ? 18 : 0,
});
const select = (crews: TodayCrewInput[], currentPlan: TodayPlanInput | null = null) => {
  const result = selectTodayState({ status: "ready", crews, plan: currentPlan });
  if (result.card !== "ready") throw new Error("Expected a ready card");
  return result;
};

describe("new Home Today state selection", () => {
  it("1: one crew, not checked in", () => expect(select([crew("fitfam")]).crew).toBe("single-not-checked"));
  it("2: one crew, checked in", () => expect(select([crew("fitfam", true)]).crew).toBe("single-checked"));
  it("3a: one crew on a rest day", () => expect(select([crew("fitfam", false, "rest")])).toMatchObject({ crew: "single-covered", cover: "rest" }));
  it("3b: one crew on a freeze", () => expect(select([crew("fitfam", false, "freeze")])).toMatchObject({ crew: "single-covered", cover: "freeze" }));
  it("4 and 5: several crews, none checked in, with missing crews for the camera", () => {
    expect(select([crew("a"), crew("b"), crew("c")])).toMatchObject({ crew: "multi-not-checked", missingCrewIds: ["a", "b", "c"] });
  });
  it("6 and 7: some crews checked in and only missing crews selected", () => {
    expect(select([crew("a", true), crew("b"), crew("c", true), crew("d")])).toMatchObject({ crew: "multi-partial", missingCrewIds: ["b", "d"] });
  });
  it("8: every crew checked in", () => expect(select([crew("a", true), crew("b", true)]).crew).toBe("multi-all-checked"));
  it("9: every crew resting or frozen", () => expect(select([crew("a", false, "rest"), crew("b", false, "freeze")])).toMatchObject({ crew: "multi-covered", cover: "rest", plan: "none" }));
  it("10: plan day not started", () => expect(select([crew("a")], plan("not_started")).plan).toBe("not-started"));
  it("11: plan workout in progress", () => expect(select([crew("a")], plan("in_progress")).plan).toBe("in-progress"));
  it("12: plan workout done but not checked in", () => expect(select([crew("a")], plan("done")).plan).toBe("done"));
  it("13: plan workout done and checked in", () => expect(select([crew("a", true)], plan("checked_in")).plan).toBe("checked-in"));
  it("14: no plan, and no plan row on a rest day", () => {
    expect(select([crew("a")]).plan).toBe("none");
    expect(select([crew("a", false, "rest")], plan("not_started")).plan).toBe("none");
  });
  it("15: loading", () => expect(selectTodayState({ status: "loading", crews: [], plan: null }).card).toBe("loading"));
  it("16: could not load", () => expect(selectTodayState({ status: "error", crews: [], plan: null }).card).toBe("error"));
  it("0 crews keeps the first-run state", () => expect(select([]).crew).toBe("empty"));
  it("a check-in wins over a rest or freeze row", () => expect(select([crew("a", true, "freeze")])).toMatchObject({ crew: "single-checked", cover: null }));
});
