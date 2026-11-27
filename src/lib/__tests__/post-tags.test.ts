import { describe, expect, it } from "vitest";
import { canTag, canRemoveMe, pruneTags, removeMe, tagPushAllowed, tagRowLabel, tagSections, tagsToNotify, withLineText, type TagCandidate, type TaggablePerson } from "../post-tags";

const author = { id: "me", under18: false, isPrivate: false };
const base: TagCandidate = { id: "x", sharedCrewIds: [], authorFollows: false, followsAuthor: false, under18: false, blockedEitherWay: false, newVersion: true };

describe("who's taggable per audience", () => {
  it("Everyone: crewmates and people you follow", () => {
    expect(canTag(author, { kind: "everyone", crewIds: ["a"] }, { ...base, sharedCrewIds: ["a"] })).toBe(true);
    expect(canTag(author, { kind: "everyone", crewIds: ["a"] }, { ...base, authorFollows: true })).toBe(true);
    expect(canTag(author, { kind: "everyone", crewIds: ["a"] }, base)).toBe(false);
  });
  it("Everyone from a private author: a followee who can't see the post is left out", () => {
    const priv = { ...author, isPrivate: true };
    expect(canTag(priv, { kind: "everyone", crewIds: [] }, { ...base, authorFollows: true })).toBe(false);
    expect(canTag(priv, { kind: "everyone", crewIds: [] }, { ...base, authorFollows: true, followsAuthor: true })).toBe(true);
  });
  it("Crews: only members of the chosen crews", () => {
    expect(canTag(author, { kind: "crews", crewIds: ["a"] }, { ...base, sharedCrewIds: ["a"] })).toBe(true);
    expect(canTag(author, { kind: "crews", crewIds: ["a"] }, { ...base, sharedCrewIds: ["b"] })).toBe(false);
    expect(canTag(author, { kind: "crews", crewIds: ["a"] }, { ...base, authorFollows: true })).toBe(false);
  });
  it("Only me: nobody", () => {
    expect(canTag(author, { kind: "only_me", crewIds: [] }, { ...base, sharedCrewIds: ["a"] })).toBe(false);
  });
  it("blocks either way are never taggable", () => {
    expect(canTag(author, { kind: "everyone", crewIds: ["a"] }, { ...base, sharedCrewIds: ["a"], blockedEitherWay: true })).toBe(false);
  });
  it("under-18 rules: no adult/teen tags outside crews, crewmates stay taggable", () => {
    expect(canTag(author, { kind: "everyone", crewIds: [] }, { ...base, authorFollows: true, under18: true })).toBe(false);
    expect(canTag({ ...author, under18: true }, { kind: "crews", crewIds: ["a"] }, { ...base, sharedCrewIds: ["a"] })).toBe(true);
    expect(canTag(author, { kind: "everyone", crewIds: ["a"] }, { ...base, sharedCrewIds: ["a"], under18: true })).toBe(true);
  });
});

describe("tag sheet sections", () => {
  const p = (id: string, name: string, section: "crew" | "follow", username: string | null = null): TaggablePerson => ({ id, name, username, avatar: null, avatarColor: null, section, crew: section === "crew" ? "FitFam" : null });
  it("someone in both shows once, under Your crews, and search matches name or username", () => {
    const people = [p("k", "Kemi Adebayo", "crew"), p("m", "Maya Lindqvist", "follow", "mayalifts"), p("k", "Kemi Adebayo", "follow")];
    const all = tagSections(people, "");
    expect(all.crew.map((x) => x.id)).toEqual(["k"]);
    expect(all.follow.map((x) => x.id)).toEqual(["m"]);
    expect(tagSections(people, "@mayal").follow.map((x) => x.id)).toEqual(["m"]);
    expect(tagSections(people, "kemi").crew.map((x) => x.id)).toEqual(["k"]);
  });
});

describe("audience change drops tags", () => {
  it("keeps only people still allowed; Only me clears all", () => {
    expect(pruneTags(["a", "b"], "crews", ["b"])).toEqual(["b"]);
    expect(pruneTags(["a", "b"], "only_me", ["a", "b"])).toEqual([]);
  });
});

describe("notifications", () => {
  it("no duplicate notification on edit: only never-notified tags", () => {
    expect(tagsToNotify([{ userId: "a", notifiedAt: "2026-11-27T10:00:00Z" }, { userId: "b", notifiedAt: null }])).toEqual(["b"]);
  });
  it("Tags toggle off blocks the push; on by default", () => {
    expect(tagPushAllowed(null)).toBe(true);
    expect(tagPushAllowed({ push_enabled: true, tags_enabled: false })).toBe(false);
    expect(tagPushAllowed({ push_enabled: false, tags_enabled: true })).toBe(false);
    expect(tagPushAllowed({ push_enabled: true, tags_enabled: null })).toBe(true);
  });
});

describe("Remove me", () => {
  it("shows only for a tagged viewer who isn't the author, and removes just them", () => {
    expect(canRemoveMe({ authorId: "a", taggedIds: ["me"] }, "me")).toBe(true);
    expect(canRemoveMe({ authorId: "a", taggedIds: ["c"] }, "me")).toBe(false);
    expect(canRemoveMe({ authorId: "me", taggedIds: ["me"] }, "me")).toBe(false);
    expect(removeMe([{ id: "me" }, { id: "c" }], "me")).toEqual([{ id: "c" }]);
  });
});

describe("with ... text", () => {
  const chris = { id: "c", name: "Chris Adeyemi" }, kemi = { id: "k", name: "Kemi Adebayo" }, me = { id: "me", name: "José Togbe" }, dani = { id: "d", name: "Dani Ruiz" };
  it("1, 2 and 3+ people", () => {
    expect(withLineText([chris], "me")).toBe("with Chris");
    expect(withLineText([chris, kemi], "me")).toBe("with Chris and Kemi");
    expect(withLineText([chris, kemi, dani], "me")).toBe("with Chris and 2 others");
  });
  it("viewer comes first as you", () => {
    expect(withLineText([chris, me], "me")).toBe("with you and Chris");
    expect(withLineText([chris, kemi, me], "me")).toBe("with you and 2 others");
  });
  it("composer row label", () => {
    expect(tagRowLabel(["Kemi Adebayo", "Chris Adeyemi"])).toBe("Kemi, Chris");
    expect(tagRowLabel(["Kemi Adebayo", "Chris Adeyemi", "Dani Ruiz"])).toBe("Kemi, Chris +1");
  });
});
