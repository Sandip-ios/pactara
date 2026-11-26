import { describe, expect, it } from "vitest";
import {
  authorListed,
  cardByline,
  cardMeta,
  compactCount,
  copyEdited,
  countLine,
  filterCards,
  mostSavedThisWeek,
  pageOf,
  timeFits,
  toCard,
  type DiscoverCard,
  type ExerciseFacts,
  type FeedRow,
} from "../discover-workouts";
import { exercisePageChips } from "../exercise-page";
import { plansByName } from "../new-discover";

const today = new Date("2026-11-26T12:00:00Z");
const base = { id: "maya", pactara: false, newVersion: true, isPrivate: false, birthday: "1994-02-01", blockedEitherWay: false };

describe("who is listed", () => {
  it("a public, new-version adult is listed", () => expect(authorListed(base, "me", today)).toBe(true));
  it("private accounts are not", () => expect(authorListed({ ...base, isPrivate: true }, "me", today)).toBe(false));
  it("classic accounts are not", () => expect(authorListed({ ...base, newVersion: false }, "me", today)).toBe(false));
  it("under-18s are not (17 the day before their birthday)", () => {
    expect(authorListed({ ...base, birthday: "2008-11-27" }, "me", today)).toBe(false);
    expect(authorListed({ ...base, birthday: "2008-11-26" }, "me", today)).toBe(true);
  });
  it("blocked either way is not", () => expect(authorListed({ ...base, blockedEitherWay: true }, "me", today)).toBe(false));
  it("my own workouts are not", () => expect(authorListed(base, "maya", today)).toBe(false));
  it("Pactara always is", () => expect(authorListed({ ...base, id: "p", pactara: true, newVersion: false }, "me", today)).toBe(true));
});

const ex = new Map<string, ExerciseFacts>([
  ["barbell-row", { name: "Bent-Over Barbell Row", primary: ["back"], equipment: "barbell", imageStart: "/row.webp", imageBg: null }],
  ["curl", { name: "Dumbbell Curl", primary: ["biceps"], equipment: "dumbbell", imageStart: "/curl.webp", imageBg: null }],
  ["plank", { name: "Plank", primary: ["abs"], equipment: "bodyweight", imageStart: null, imageBg: null }],
  ["squat", { name: "Bodyweight Squat", primary: ["quads", "glutes"], equipment: "bodyweight", imageStart: null, imageBg: null }],
]);
const row = (o: Partial<FeedRow>): FeedRow => ({
  code: "AAAAAAAA", name: "Back day", exercises: [{ exerciseId: "barbell-row", sets: 4, repsTarget: "8-12", secondsTarget: null, reps: "8" }],
  equipment: null, cover_url: null, pactara: false, owner_name: "Maya Lindqvist", created_at: "2026-11-20T10:00:00Z",
  saves: 0, saves_week: 0, did_it: 0, my_copy_id: null, my_copy_name: null, my_copy_exercises: null, ...o,
});

const snap = (exerciseId: string, sets: number) => ({ exerciseId, sets, repsTarget: null, secondsTarget: null });

describe("workout covers", () => {
  it("a multi-exercise member workout uses its stock photo, never an exercise drawing", () => {
    const c = toCard(row({ cover_url: "/__l5e/assets-v1/photo/back-1.jpg", exercises: [snap("barbell-row", 4), snap("curl", 3)] }), ex);
    expect(c.coverUrl).toBe("/__l5e/assets-v1/photo/back-1.jpg");
    expect(c.drawing).toBeNull();
  });
  it("a multi-exercise workout never uses a drawing when another exercise is not visible", () => {
    const c = toCard(row({ cover_url: "/__l5e/assets-v1/photo/back-1.jpg", exercises: [snap("barbell-row", 4), snap("member-custom", 3)] }), ex);
    expect(c.exercises).toBe(1);
    expect(c.coverUrl).toBe("/__l5e/assets-v1/photo/back-1.jpg");
    expect(c.drawing).toBeNull();
  });
  it("a Pactara workout keeps its plan cover", () => {
    const c = toCard(row({ pactara: true, cover_url: "https://images.unsplash.com/plan.jpg", exercises: [snap("barbell-row", 4), snap("curl", 3)] }), ex);
    expect(c.coverUrl).toBe("https://images.unsplash.com/plan.jpg");
    expect(c.drawing).toBeNull();
  });
  it("only a single-exercise workout falls back to its exercise drawing", () => {
    const c = toCard(row({ cover_url: null }), ex);
    expect(c.exercises).toBe(1);
    expect(c.coverUrl).toBeNull();
    expect(c.drawing).toEqual({ src: "/row.webp", bg: "#D8F1FD" });
  });
});

describe("counts and card text", () => {
  it("saves read 1.2k, hide · 0 saves", () => {
    expect(compactCount(1234)).toBe("1.2k");
    expect(compactCount(12400)).toBe("12k");
    expect(compactCount(980)).toBe("980");
    expect(cardByline({ author: "Maya Lindqvist", saves: 0 }).saves).toBe("");
    expect(cardByline({ author: "Maya Lindqvist", saves: 1200 }).saves).toBe(" · 1.2k saves");
  });
  it("meta line and inferred equipment", () => {
    const c = toCard(row({ exercises: [...row({}).exercises, { exerciseId: "curl", sets: 3, repsTarget: "8-12", secondsTarget: null }] }), ex);
    expect(cardMeta(c)).toBe("2 exercises · 20 min · Gym");
    expect(c.muscles).toEqual(["back", "arms"]);
  });
  it("count line", () => {
    expect(countLine(48, "back")).toBe("48 back workouts");
    expect(countLine(1, "all")).toBe("1 workout");
  });
});

const card = (o: Partial<DiscoverCard>): DiscoverCard => ({ ...toCard(row({}), ex), ...o });

describe("filters", () => {
  const list = [
    card({ code: "a", muscles: ["back"], equipment: "gym", minutes: 45, saves: 3, createdAt: "2026-11-01" }),
    card({ code: "b", muscles: ["legs", "glutes"], equipment: "home", minutes: 15, saves: 9, createdAt: "2026-11-02", name: "Leg day", exerciseNames: ["Bodyweight Squat"] }),
    card({ code: "c", muscles: ["back", "arms"], equipment: "dumbbells", minutes: 30, saves: 0, createdAt: "2026-11-03" }),
  ];
  const q = { muscle: "all" as const, equipment: null, time: null, sort: "saved" as const, q: "" };
  it("muscle", () => expect(filterCards(list, { ...q, muscle: "back" }).map((c) => c.code)).toEqual(["a", "c"]));
  it("equipment", () => expect(filterCards(list, { ...q, equipment: "dumbbells" }).map((c) => c.code)).toEqual(["c"]));
  it("time buckets", () => {
    expect(timeFits(19, "u20")).toBe(true);
    expect(timeFits(20, "20-40")).toBe(true);
    expect(timeFits(40, "40plus")).toBe(false);
    expect(filterCards(list, { ...q, time: "40plus" }).map((c) => c.code)).toEqual(["a"]);
  });
  it("search matches names and exercises", () => expect(filterCards(list, { ...q, q: "squat" }).map((c) => c.code)).toEqual(["b"]));
  it("most saved vs newest", () => {
    expect(filterCards(list, q).map((c) => c.code)).toEqual(["b", "a", "c"]);
    expect(filterCards(list, { ...q, sort: "newest" }).map((c) => c.code)).toEqual(["c", "b", "a"]);
  });
  it("pages of 20", () => {
    const many = Array.from({ length: 45 }, (_, i) => i);
    expect(pageOf(many, 0).nextOffset).toBe(20);
    expect(pageOf(many, 40)).toEqual({ items: [40, 41, 42, 43, 44], nextOffset: null });
  });
});

describe("Most saved this week fallback", () => {
  it("this week first, then all-time, then Pactara picks", () => {
    const list = [
      card({ code: "old", saves: 50, savesWeek: 0 }),
      card({ code: "hot", saves: 5, savesWeek: 4 }),
      card({ code: "p1", pactara: true }),
      card({ code: "p2", pactara: true }),
      card({ code: "p3", pactara: true }),
    ];
    expect(mostSavedThisWeek(list).map((c) => c.code)).toEqual(["hot", "old", "p1", "p2"]);
  });
  it("never empty when only Pactara workouts exist", () => expect(mostSavedThisWeek([card({ code: "p", pactara: true })]).length).toBe(1));
});

describe("unsave asks only when I edited my copy", () => {
  const snap = [{ exerciseId: "barbell-row", sets: 4, repsTarget: "8-12", secondsTarget: null, reps: "8" }];
  it("untouched copy (even renamed Back day 2)", () => expect(copyEdited("Back day", snap, "Back day 2", [{ exerciseId: "barbell-row", sets: 4, reps: "8" }])).toBe(false));
  it("changed sets", () => expect(copyEdited("Back day", snap, "Back day", [{ exerciseId: "barbell-row", sets: 5, reps: "8" }])).toBe(true));
  it("renamed", () => expect(copyEdited("Back day", snap, "Pull day", [{ exerciseId: "barbell-row", sets: 4, reps: "8" }])).toBe(true));
});

describe("exercise page chips", () => {
  it("detailed primary first, then secondary, max 3", () =>
    expect(exercisePageChips({ primary: ["back"], detail: ["upper back", "lats"], secondary: ["biceps", "shoulders"] })).toEqual(["Upper back", "Lats", "Biceps"]));
});

describe("plans search", () => {
  it("matches plan name only", () => {
    const plans = [{ name: "Gym strength", summary: "dumbbells" }, { name: "Dumbbell basics", summary: "" }];
    expect(plansByName(plans, "dumbbell").map((p) => p.name)).toEqual(["Dumbbell basics"]);
  });
});
