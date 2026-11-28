import { describe, expect, it } from "vitest";
import { HOME_INITIAL_TAB, homeEligible, homeEmptyState, homePage, showHomeToday, type HomeRef } from "../home-feed";
const item = {
  own: false,
  crew: false,
  peer: false,
  followed: false,
  shared: true,
  public: true,
  blocked: false,
  hidden: false,
};
describe("new Home audience rules", () => {
  it("opens on Following", () => expect(HOME_INITIAL_TAB).toBe("following"));
  it("shows the crew card on Following and not on For you", () => {
    expect(showHomeToday("following")).toBe(true);
    expect(showHomeToday("for-you")).toBe(false);
  });
  it("For you empty includes posting and Discover actions with the shared suggestions list", () => {
    const suggestions = [{ id: "one" }, { id: "two" }];
    const forYou = homeEmptyState("for-you", suggestions);
    const following = homeEmptyState("following", suggestions);
    expect(forYou).toMatchObject({ showShare: true, showDiscover: true, showSuggestions: true });
    expect(forYou.suggestions).toBe(suggestions);
    expect(following.suggestions).toBe(forYou.suggestions);
    expect(following.showSuggestions).toBe(true);
    expect(homeEmptyState("for-you", []).showSuggestions).toBe(false);
  });
  it("Following includes own, crews and explicitly shared follows", () => {
    expect(homeEligible("following", { ...item, own: true, shared: false })).toBe(true);
    expect(homeEligible("following", { ...item, crew: true, shared: false })).toBe(true);
    expect(homeEligible("following", { ...item, followed: true })).toBe(true);
    expect(homeEligible("following", { ...item, followed: true, shared: false })).toBe(false);
  });
  it("For you excludes self, follows and crew peers", () => {
    expect(homeEligible("for-you", item)).toBe(true);
    for (const flag of ["own", "followed", "peer"] as const)
      expect(homeEligible("for-you", { ...item, [flag]: true })).toBe(false);
  });
  it("For you excludes private and unshared content", () => {
    expect(homeEligible("for-you", { ...item, public: false })).toBe(false);
    expect(homeEligible("for-you", { ...item, shared: false })).toBe(false);
  });
  it("both tabs exclude blocked and hidden content", () => {
    for (const tab of ["following", "for-you"] as const) {
      expect(homeEligible(tab, { ...item, own: true, blocked: true })).toBe(false);
      expect(homeEligible(tab, { ...item, crew: true, hidden: true })).toBe(false);
    }
  });
  it("pages at 20 with a stable same-time cursor and deduplicates", () => {
    const refs: HomeRef[] = Array.from({ length: 21 }, (_, i) => ({
      kind: "post",
      id: String(i),
      key: `post:${String(i).padStart(2, "0")}`,
      created_at: "2026-11-27T10:00:00Z",
      group_id: null,
      crew_name: null,
    }));
    const page = homePage([...refs, ...refs]);
    expect(page.page).toHaveLength(20);
    expect(page.next).toEqual({ at: "2026-11-27T10:00:00Z", key: "post:01" });
    expect(homePage(refs.slice(0, 20)).next).toBeNull();
  });
});
