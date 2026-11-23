import { describe, expect, it } from "vitest";
import { milestonesReached } from "../badges";
import { currentStreak } from "../streak-rules";
import {
  cardToggles,
  crewLine,
  DEFAULT_CARD_PREFS,
  formatClipDuration,
  outputSize,
  parseCardPrefs,
  prPillText,
  shareCardLines,
  shareFileName,
  statsLine,
  weekLine,
  type ShareCardInput,
} from "../share-card";

const workoutWithPr: ShareCardInput = {
  streak: 12,
  crewName: "FitFam",
  relation: "crew",
  activityLabel: "Workout",
  week: { done: 4, target: 5, days: ["checked", "checked", "rest", "checked", "checked", "none", "none"] },
  workout: {
    title: "Push day",
    minutes: 42,
    volume: 6240,
    unit: "lb",
    sets: 16,
    pr: { name: "Bench", weight: 80, unit: "lb", reps: 8 },
  },
};
const videoOnly: ShareCardInput = { ...workoutWithPr, workout: null };

describe("streak bug: badge, card and share card use one number", () => {
  // José, Nov 22 2026 (America/Chicago): check-ins Nov 16 and 18, rest rows
  // Nov 17 and 19 (added by the Nov 22 correction), nothing Nov 20–21.
  const kept = new Set(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-22"]);

  it("the current streak is Day 1", () => {
    expect(currentStreak(kept, "2026-11-22")).toBe(1);
  });

  it("a Day 1 check-in no longer unlocks the 3-day spark (old rule used the Nov 16–19 run)", () => {
    expect(milestonesReached(1, [1])).toEqual([]);
  });

  it("Day 3 unlocks the 3-day spark once", () => {
    expect(milestonesReached(3, [1])).toEqual([3]);
    expect(milestonesReached(3, [1, 3])).toEqual([]);
  });

  it("the share card says the same day", () => {
    const lines = shareCardLines({ ...videoOnly, streak: 1 }, DEFAULT_CARD_PREFS);
    expect(lines[0]).toEqual({ kind: "title", text: "🔥 Day 1 streak" });
  });
});

describe("logged workout card", () => {
  it("defaults to PR pill, workout name and one stats line", () => {
    expect(shareCardLines(workoutWithPr, DEFAULT_CARD_PREFS)).toEqual([
      { kind: "pill", text: "PR · Bench 80 lb × 8" },
      { kind: "title", text: "Push day" },
      { kind: "sub", text: "42m · 6,240 lb · 16 sets", weight: 700 },
    ]);
  });

  it("without a PR there is no pill and no New PR switch", () => {
    const noPr = { ...workoutWithPr, workout: { ...workoutWithPr.workout!, pr: null } };
    expect(shareCardLines(noPr, DEFAULT_CARD_PREFS).map((l) => l.kind)).toEqual(["title", "sub"]);
    expect(cardToggles(noPr).map((t) => t.key)).toEqual(["stats", "streak", "crew"]);
    expect(cardToggles(workoutWithPr).map((t) => t.key)).toEqual(["stats", "pr", "streak", "crew"]);
  });

  it("Streak and Crew line switches add their lines with the crew's name", () => {
    const prefs = { ...DEFAULT_CARD_PREFS, workout: { stats: true, pr: true, streak: true, crew: true } };
    expect(shareCardLines(workoutWithPr, prefs).slice(3).map((l) => l.kind !== "week" && "text" in l && l.text)).toEqual([
      "🔥 Day 12 streak",
      "Staying accountable with my FitFam crew",
    ]);
  });

  it("stats skip empty parts (bodyweight workout)", () => {
    expect(statsLine({ ...workoutWithPr.workout!, volume: 0, sets: 1 })).toBe("42m · 1 set");
  });

  it("bodyweight PRs show reps only", () => {
    expect(prPillText({ name: "Push-up", weight: 0, unit: "lb", reps: 20 })).toBe("PR · Push-up × 20");
  });
});

describe("video-only card", () => {
  it("defaults to streak + plain crew line (no crew name)", () => {
    expect(shareCardLines(videoOnly, DEFAULT_CARD_PREFS)).toEqual([
      { kind: "title", text: "🔥 Day 12 streak" },
      { kind: "sub", text: "Staying accountable with my crew", weight: 600 },
    ]);
  });

  it("Activity adds the label above, This week adds the count and dots", () => {
    const prefs = { ...DEFAULT_CARD_PREFS, video: { streak: true, crew: true, activity: true, week: true } };
    const lines = shareCardLines(videoOnly, prefs);
    expect(lines[0]).toEqual({ kind: "kicker", text: "WORKOUT" });
    expect(lines[3]).toEqual({ kind: "week", text: "4 of 5 workouts this week", days: videoOnly.week!.days });
  });

  it("drops 'of 5' once the weekly goal is met or beaten", () => {
    expect(weekLine({ done: 4, target: 5 })).toBe("4 of 5 workouts this week");
    expect(weekLine({ done: 5, target: 5 })).toBe("5 workouts this week");
    expect(weekLine({ done: 6, target: 5 })).toBe("6 workouts this week");
    expect(weekLine({ done: 1, target: 5 })).toBe("1 of 5 workouts this week");
  });

  it("partner and solo pacts get wording outsiders understand", () => {
    expect(crewLine({ crewName: "You + Busi", relation: "partner" }, true)).toBe("Staying accountable with my partner");
    expect(crewLine({ crewName: "My 90-Day Pact", relation: "solo" }, false)).toBe("Staying accountable every day");
    expect(crewLine({ crewName: "Morning crew", relation: "crew" }, true)).toBe("Staying accountable with my Morning crew");
  });
});

describe("remembered switches", () => {
  it("restores saved choices per card type and defaults the rest", () => {
    const p = parseCardPrefs(JSON.stringify({ video: { week: true, crew: false }, workout: { stats: "x" } }));
    expect(p.video).toEqual({ streak: true, crew: false, activity: false, week: true });
    expect(p.workout).toEqual(DEFAULT_CARD_PREFS.workout);
    expect(parseCardPrefs("not json")).toEqual(DEFAULT_CARD_PREFS);
  });
});

describe("files and sizes", () => {
  it("names the MP4 after the streak day", () => {
    expect(shareFileName(12)).toBe("Pactara - Day 12.mp4");
  });
  it("formats the duration pill", () => {
    expect(formatClipDuration(12.4)).toBe("0:12");
    expect(formatClipDuration(65)).toBe("1:05");
  });
  it("Story is 9:16 and Post is 1:1", () => {
    expect(outputSize("story", 1080)).toEqual({ width: 1080, height: 1920 });
    expect(outputSize("post", 1080)).toEqual({ width: 1080, height: 1080 });
    expect(outputSize("story", 720)).toEqual({ width: 720, height: 1280 });
  });
});
