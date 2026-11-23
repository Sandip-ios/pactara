import { describe, expect, it } from "vitest";
import {
  isShareCode,
  itemsFromLoggedWorkout,
  itemsFromSnapshot,
  makeShareCode,
  postDayLabel,
  shareDescription,
  shareText,
  shareTitle,
  shareUrl,
  sharedMeta,
  snapshotKey,
  snapshotOf,
  targetLine,
  uniqueWorkoutName,
} from "@/lib/workout-share";
import { isPublicLinkPath } from "@/lib/launch-route";

describe("saving a crewmate's workout", () => {
  const logged = [
    { exerciseId: "bench", logType: "reps" as const, sets: [{ seconds: null }, { seconds: null }, { seconds: null }] },
    { exerciseId: "plank", logType: "timed" as const, sets: [{ seconds: 45 }, { seconds: 60 }] },
    { exerciseId: "row", logType: "reps" as const, sets: [{ seconds: null }] },
  ];
  it("keeps the order and the number of sets they logged", () => {
    expect(itemsFromLoggedWorkout(logged).map((i) => [i.exerciseId, i.sets])).toEqual([
      ["bench", 3],
      ["plank", 2],
      ["row", 1],
    ]);
  });
  it("never copies weights; rep moves get no fixed target (the 8–12 rule applies)", () => {
    expect(itemsFromLoggedWorkout(logged)[0]).toEqual({ exerciseId: "bench", sets: 3 });
  });
  it("timed moves keep their logged time as the target", () => {
    expect(itemsFromLoggedWorkout(logged)[1]).toEqual({ exerciseId: "plank", sets: 2, seconds: 60 });
  });
});

describe("names of saved copies", () => {
  it("uses the post's workout title", () => {
    expect(uniqueWorkoutName("Push day", [])).toBe("Push day");
  });
  it('falls back to "Workout" without a title', () => {
    expect(uniqueWorkoutName(null, [])).toBe("Workout");
    expect(uniqueWorkoutName("  ", [])).toBe("Workout");
  });
  it('adds " (2)", then " (3)" when the name is taken', () => {
    expect(uniqueWorkoutName("Push day", ["Push day"])).toBe("Push day (2)");
    expect(uniqueWorkoutName("Push day", ["Push day", "Push day (2)"])).toBe("Push day (3)");
  });
});

describe("share links", () => {
  it("codes are 8 letters or digits", () => {
    const code = makeShareCode();
    expect(code).toHaveLength(8);
    expect(isShareCode(code)).toBe(true);
    expect(isShareCode("short")).toBe(false);
    expect(isShareCode("abc-defg")).toBe(false);
  });
  it("link, title and text", () => {
    expect(shareUrl("Ab3dEf7h")).toBe("https://pactara.lovable.app/w/Ab3dEf7h");
    expect(shareTitle("Push day")).toBe("Push day · Pactara");
    expect(shareText("Push day")).toBe("Try my Push day on Pactara");
  });
  it("the snapshot has set and rep targets, never weights", () => {
    const snap = snapshotOf(
      [
        { exerciseId: "bench", sets: 3, restSeconds: 120 },
        { exerciseId: "plank", sets: 2, seconds: 60 },
      ],
      (id) => (id === "plank" ? "timed" : "reps"),
    );
    expect(snap).toEqual([
      { exerciseId: "bench", sets: 3, repsTarget: "8-12", secondsTarget: null },
      { exerciseId: "plank", sets: 2, repsTarget: null, secondsTarget: 60 },
    ]);
  });
  it("same name and exercises reuse the link; any change makes a new one", () => {
    const a = [{ exerciseId: "bench", sets: 3, repsTarget: "8-12", secondsTarget: null }];
    expect(snapshotKey("Push day", a)).toBe(snapshotKey(" Push day ", [...a]));
    expect(snapshotKey("Push day", a)).not.toBe(snapshotKey("Push day", [{ ...a[0]!, sets: 4 }]));
    expect(snapshotKey("Push day", a)).not.toBe(snapshotKey("Pull day", a));
  });
  it("saving a link keeps sets and timed targets", () => {
    expect(
      itemsFromSnapshot([
        { exerciseId: "bench", sets: 3, repsTarget: "8-12", secondsTarget: null },
        { exerciseId: "plank", sets: 2, repsTarget: null, secondsTarget: 45 },
      ]),
    ).toEqual([
      { exerciseId: "bench", sets: 3 },
      { exerciseId: "plank", sets: 2, seconds: 45 },
    ]);
  });
  it("page and preview wording", () => {
    const items = [
      { sets: 3, repsTarget: "8-12", secondsTarget: null },
      { sets: 3, repsTarget: "8-12", secondsTarget: null },
      { sets: 2, repsTarget: null, secondsTarget: 30 },
      { sets: 2, repsTarget: "8-12", secondsTarget: null },
    ];
    expect(targetLine(items[0]!)).toBe("3 sets · 8–12 reps");
    expect(targetLine(items[2]!)).toBe("2 sets · 30 sec");
    expect(sharedMeta(items)).toBe("4 exercises · 10 sets · about 25 min");
    expect(shareDescription("Ana", items)).toBe("Ana shared a workout: 4 exercises · about 25 min");
  });
  it("only /w/<code> links count as public at launch", () => {
    expect(isPublicLinkPath("/w/Ab3dEf7h")).toBe(true);
    expect(isPublicLinkPath("/home?post=1")).toBe(false);
    expect(isPublicLinkPath("/w/nope")).toBe(false);
  });
});

describe("feed sheet header day", () => {
  it("Today / Yesterday / weekday / date from the viewer's today", () => {
    expect(postDayLabel("2026-11-23", "2026-11-23")).toBe("Today");
    expect(postDayLabel("2026-11-22", "2026-11-23")).toBe("Yesterday");
    expect(postDayLabel("2026-11-19", "2026-11-23")).toBe("Thursday");
    expect(postDayLabel("2026-11-03", "2026-11-23")).toBe("Nov 3");
  });
  it("a crewmate already on tomorrow still reads Today", () => {
    expect(postDayLabel("2026-11-24", "2026-11-23")).toBe("Today");
  });
});
