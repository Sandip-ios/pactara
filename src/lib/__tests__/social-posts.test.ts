import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { audienceIsValid, canSeePost, defaultAudience, reachesFollowers, toggleCrew, toggleEveryone } from "../post-audience";
import { fileTooBigMessage, videoLengthError, composerIsDirty, creditLine, moveItem, selectionNumber, shareWorkoutStats, skipsDiscover, toggleSelection, trimLabel } from "../post-composer";
import { bestExerciseMatch, foundLabel, parseCaptionMoves, setsRepsLine } from "../caption-workout";
import { jobProgress } from "../posting-queue";

const ROOT = new URL("../../../", import.meta.url);
const viewer = { id: "v", crewIds: ["c1"], followsAuthor: false, blockedEitherWay: false };
const post = (p: Partial<Parameters<typeof canSeePost>[0]>) => ({ authorId: "a", live: true, everyone: false, crewIds: [], authorPrivate: false, ...p });

describe("who sees a post", () => {
  it("crew only: crewmates see it, outsiders and followers don't, and it never reaches followers' feeds", () => {
    const p = post({ crewIds: ["c1"] });
    expect(canSeePost(p, viewer)).toBe(true);
    expect(canSeePost(p, { ...viewer, crewIds: ["c9"], followsAuthor: true })).toBe(false);
    expect(reachesFollowers({ everyone: false })).toBe(false);
  });
  it("everyone only: a non-crewmate sees a public author's post; private authors need an accepted follow", () => {
    expect(canSeePost(post({ everyone: true }), { ...viewer, crewIds: [] })).toBe(true);
    expect(canSeePost(post({ everyone: true, authorPrivate: true }), { ...viewer, crewIds: [] })).toBe(false);
    expect(canSeePost(post({ everyone: true, authorPrivate: true }), { ...viewer, crewIds: [], followsAuthor: true })).toBe(true);
    expect(reachesFollowers({ everyone: true })).toBe(true);
  });
  it("both: crewmates and everyone; blocked pairs and unfinished uploads stay hidden", () => {
    const p = post({ everyone: true, crewIds: ["c1"] });
    expect(canSeePost(p, viewer)).toBe(true);
    expect(canSeePost(p, { ...viewer, blockedEitherWay: true })).toBe(false);
    expect(canSeePost({ ...p, live: false }, viewer)).toBe(false);
    expect(canSeePost({ ...p, live: false }, { ...viewer, id: "a" })).toBe(true);
  });
  it("both chips start on, and at least one must stay on", () => {
    const a = defaultAudience(["c1"], false);
    expect(a).toEqual({ everyone: true, crewIds: ["c1"] });
    const crewOff = toggleCrew(a, "c1", false);
    expect(crewOff).toEqual({ everyone: true, crewIds: [] });
    expect(toggleEveryone(crewOff, false)).toEqual(crewOff);
    expect(audienceIsValid({ everyone: false, crewIds: [] }, false)).toBe(false);
  });
  it("under-18: no Everyone, crews only, and Everyone can't be turned on", () => {
    const a = defaultAudience(["c1", "c2"], true);
    expect(a).toEqual({ everyone: false, crewIds: ["c1", "c2"] });
    expect(toggleEveryone(a, true).everyone).toBe(false);
    expect(audienceIsValid({ everyone: true, crewIds: ["c1"] }, true)).toBe(false);
    expect(toggleCrew(toggleCrew(a, "c1", true), "c2", true).crewIds).toEqual(["c2"]);
  });
});

describe("a post never touches streaks or check-ins", () => {
  const sources = [
    "src/lib/posts.functions.ts", "src/lib/post-submit.ts", "src/lib/posting-queue.ts",
    ...readdirSync(new URL("src/components/redesign/post/", ROOT)).map((f) => `src/components/redesign/post/${f}`),
  ].map((f) => readFileSync(new URL(f, ROOT), "utf8"));
  const migration = readdirSync(new URL("drizzle/migrations/", ROOT)).find((f) => f.includes("camera_roll_posts"))!;
  const sql = readFileSync(new URL(`drizzle/migrations/${migration}`, ROOT), "utf8");
  it("posting code never writes check-ins, daily posts, streak freezes or crew check-in pushes", () => {
    for (const src of sources) {
      expect(src).not.toMatch(/from\("(check_ins|daily_posts|streak_freezes_used|plan_workout_logs)"\)/);
      expect(src).not.toMatch(/recordCheckIn|checkin-push|notifyCrew/);
    }
  });
  it("the post store and its create function only insert into post tables", () => {
    const inserts = [...sql.matchAll(/INSERT INTO public\.(\w+)/g)].map((m) => m[1]);
    expect(inserts.length).toBeGreaterThan(0);
    for (const t of inserts) expect(t).toMatch(/^social_post/);
    expect(sql).not.toMatch(/check_ins|daily_posts/);
  });
});

describe("picker, editor and composer", () => {
  it("numbers picks in order and caps at 10", () => {
    let s: string[] = [];
    for (let i = 0; i < 12; i++) s = toggleSelection(s, `m${i}`);
    expect(s).toHaveLength(10);
    s = toggleSelection(s, "m0");
    expect(selectionNumber(s, "m1")).toBe(1);
    expect(selectionNumber(s, "m0")).toBeNull();
  });
  it("trim label, reorder, Discover skip and discard", () => {
    expect(trimLabel({ duration: 18, trimStart: 3, trimEnd: 15 })).toBe("Trimmed to 0:12 of 0:18");
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(skipsDiscover([{ kind: "video", duration: 200, trimStart: 0, trimEnd: 200 }])).toBe(true);
    expect(skipsDiscover([{ kind: "video", duration: 200, trimStart: 0, trimEnd: 170 }])).toBe(false);
    expect(composerIsDirty({ items: 0, caption: "  ", workoutAttached: false })).toBe(false);
    expect(composerIsDirty({ items: 1, caption: "", workoutAttached: false })).toBe(true);
  });
  it("share workout wording", () => {
    expect(shareWorkoutStats({ minutes: 46, sets: 20, prs: 2 })).toBe("46 min · 20 sets · 2 personal bests");
    expect(shareWorkoutStats({ minutes: 30, sets: 1, prs: 0 })).toBe("30 min · 1 set");
    expect(shareWorkoutStats({ minutes: 0, sets: 2, prs: 0 })).toBe("2 sets");
    expect(creditLine("Maya")).toBe("Credits Maya. They get a notification.");
  });
  it("posting progress counts finished bytes", () => {
    expect(jobProgress([{ size: 100, done: true }, { size: 100, done: false }], 1, 0.5)).toBe(75);
  });
});

describe("workout from the caption", () => {
  it("finds sets and reps and drops weights", () => {
    const moves = parseCaptionMoves("Leg day!\nSquat 4x8 @ 100kg\nRDL 3 sets of 10\nfelt great");
    expect(moves).toEqual([{ query: "Squat", sets: 4, reps: 8 }, { query: "RDL", sets: 3, reps: 10 }]);
    expect(JSON.stringify(moves)).not.toMatch(/100|kg/);
    expect(foundLabel(2)).toBe("We found 2 exercises");
    expect(setsRepsLine(4, 8)).toBe("4 sets · 8 reps");
  });
  it("matches the library by name", () => {
    const lib = [{ name: "Barbell Back Squat" }, { name: "Squat" }, { name: "Bench Press" }];
    expect(bestExerciseMatch("squats", lib)?.name).toBe("Squat");
    expect(bestExerciseMatch("bench", lib)?.name).toBe("Bench Press");
  });
});

describe("upload limits", () => {
  const v = (len: number) => ({ kind: "video" as const, duration: len, trimStart: 0, trimEnd: len });
  it("crew-only videos up to 3 minutes", () => {
    expect(videoLengthError([v(180)], false)).toBeNull();
    expect(videoLengthError([v(200)], false)).toBe("This video is 3:20. Crew-only posts take videos up to 3:00. Trim it or turn on Everyone.");
  });
  it("Everyone videos up to 10 minutes", () => {
    expect(videoLengthError([v(200)], true)).toBeNull();
    expect(videoLengthError([v(601)], true)).toBe("This video is 10:01. Videos can be up to 10:00. Trim it to post.");
    expect(videoLengthError([{ ...v(900), trimEnd: 500 }], true)).toBeNull();
  });
  it("files over 200 MB get a message", () => {
    expect(fileTooBigMessage(200 * 1024 * 1024)).toBeNull();
    expect(fileTooBigMessage(200 * 1024 * 1024 + 1)).toBe("This file is too big to post. Pick one under 200 MB.");
  });
});
