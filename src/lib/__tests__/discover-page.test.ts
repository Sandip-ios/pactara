import { describe, expect, it } from "vitest";
import {
  workoutEmptyLine,
  popularPlans,
  discoverTopCard,
  showDiscoverRow,
  searchGroups,
  searchablePerson,
  recentSearches,
  readRecentSearches,
  writeRecentSearches,
  searchMatches,
  didYouMean,
  type SearchPerson,
  type SearchResults,
} from "../discover-page";
const person: SearchPerson = {
  id: "a",
  name: "José",
  username: "jose",
  bio: null,
  avatar: null,
  isPrivate: true,
  relationship: "none",
  canFollow: true,
  context: "",
  isYou: false,
};
describe("Discover one page", () => {
  it("names the approved core kettlebell under-15 filters", () =>
    expect(
      workoutEmptyLine({
        muscle: "core",
        equipment: "kettlebell",
        time: "u15",
        sort: "saved",
        q: "",
      }),
    ).toBe("Nothing for core with a kettlebell under 15 min. Try fewer filters."));
  it("ranks by starts, excludes your plan and caps at 8", () => {
    const plans = Array.from({ length: 11 }, (_, i) => ({ id: String(i), slug: String(i) }));
    const starts = Object.fromEntries(plans.map((p) => [p.id, Number(p.id)]));
    expect(popularPlans(plans, starts, "10").map((p) => p.id)).toEqual([
      "9",
      "8",
      "7",
      "6",
      "5",
      "4",
      "3",
      "2",
    ]);
  });
  it("active plan wins even with a saved quiz", () =>
    expect(discoverTopCard(true, true)).toBe("onPlan"));
  it("no plan and no quiz shows the quiz", () =>
    expect(discoverTopCard(false, false)).toBe("quizNotTaken"));
  it("saved answers without a plan show the match", () =>
    expect(discoverTopCard(false, true)).toBe("quizTaken"));
  it("hides empty rows but preserves loading and errors", () => {
    expect(showDiscoverRow(0, false, false)).toBe(false);
    expect(showDiscoverRow(0, true, false)).toBe(true);
    expect(showDiscoverRow(0, false, true)).toBe(true);
    expect(showDiscoverRow(1, false, false)).toBe(true);
  });
  it("orders nonempty groups and shows 3 with expansion counts", () => {
    const r: SearchResults = {
      people: [person, person, person, person],
      workouts: [],
      plans: [],
      suggestion: null,
    };
    const groups = searchGroups(r);
    expect(groups.map((g) => g.key)).toEqual(["people"]);
    expect(groups[0]?.items.length).toBe(3);
    expect(groups[0]?.seeAll).toBe("See all 4");
    expect(searchGroups(r, ["people"])[0]?.items.length).toBe(4);
  });
  it("search ignores case and accents in every word", () => {
    expect(searchMatches("JOSE", ["José"])).toBe(true);
    expect(searchMatches("glute squat", ["Glute strength", "Squat"])).toBe(true);
    expect(searchMatches("bench", ["Squat"])).toBe(false);
  });
  it("excludes both-direction blocks", () =>
    expect(
      searchablePerson({
        blockedEitherWay: true,
        viewerAdult: true,
        under18: false,
        newVersion: true,
      }),
    ).toBe(false));
  it("adults never see teens", () =>
    expect(
      searchablePerson({
        blockedEitherWay: false,
        viewerAdult: true,
        under18: true,
        newVersion: true,
      }),
    ).toBe(false));
  it("private adults can appear; classic people cannot", () => {
    expect(
      searchablePerson({
        blockedEitherWay: false,
        viewerAdult: true,
        under18: false,
        newVersion: true,
      }),
    ).toBe(true);
    expect(
      searchablePerson({
        blockedEitherWay: false,
        viewerAdult: true,
        under18: false,
        newVersion: false,
      }),
    ).toBe(false);
  });
  it("recents dedupe, newest first and cap at 8", () => {
    expect(recentSearches(["José", "Back"], " JOSE ")).toEqual(["JOSE", "Back"]);
    expect(
      recentSearches(
        Array.from({ length: 10 }, (_, i) => String(i)),
        "new",
      ),
    ).toEqual(["new", "0", "1", "2", "3", "4", "5", "6"]);
  });
  it("survives phone storage failures and malformed history", () => {
    expect(readRecentSearches({ getItem: () => "{", setItem: () => {} })).toEqual([]);
    expect(() =>
      writeRecentSearches(
        {
          getItem: () => null,
          setItem: () => {
            throw Error("disabled");
          },
        },
        ["x"],
      ),
    ).not.toThrow();
  });
  it("suggests glutes for glutr but not unrelated words", () => {
    expect(didYouMean("glutr", ["glutes", "back", "core"])).toBe("glutes");
    expect(didYouMean("astronaut", ["glutes", "back"])).toBe(null);
    expect(didYouMean("glutes", ["glutes"])).toBe(null);
  });
});
