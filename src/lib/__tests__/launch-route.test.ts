import { describe, expect, it } from "vitest";
import { decideLaunch, toAppPath, type LaunchFacts } from "@/lib/launch-route";

const base: LaunchFacts = {
  native: true,
  signedIn: true,
  inviteGroupId: null,
  linkPath: null,
  signupResume: null,
  goalGroupId: null,
  pactGroupId: null,
  partnerPending: false,
};

describe("where a cold launch lands", () => {
  it("signed out in the app → login", () => {
    expect(decideLaunch({ ...base, signedIn: false })).toEqual({ to: "login" });
  });
  it("signed out on the web keeps the landing page", () => {
    expect(decideLaunch({ ...base, native: false, signedIn: false })).toEqual({ to: "landing" });
  });
  it("signed out with a notification still goes to login first", () => {
    expect(decideLaunch({ ...base, signedIn: false, linkPath: "/home?post=p1" })).toEqual({ to: "login" });
  });
  it("a notification tap opens its screen, ahead of an unsigned pact", () => {
    expect(decideLaunch({ ...base, linkPath: "/home?group=g1&post=p1&comments=1", pactGroupId: "g2" })).toEqual({
      to: "link",
      href: "/home?group=g1&post=p1&comments=1",
    });
  });
  it("unfinished goal comes before an unsigned pact", () => {
    expect(decideLaunch({ ...base, goalGroupId: "g1", pactGroupId: "g2", partnerPending: true })).toEqual({ to: "goal", groupId: "g1" });
  });
  it("unsigned pact comes before a waiting match", () => {
    expect(decideLaunch({ ...base, pactGroupId: "g2", partnerPending: true })).toEqual({ to: "pact", groupId: "g2" });
  });
  it("a match waiting for you opens the partner screen", () => {
    expect(decideLaunch({ ...base, partnerPending: true })).toEqual({ to: "partner" });
  });
  it("otherwise Home (even if you haven't checked in today)", () => {
    expect(decideLaunch(base)).toEqual({ to: "home" });
  });
  it("an invite link wins over everything", () => {
    expect(decideLaunch({ ...base, signedIn: false, inviteGroupId: "g9" })).toEqual({ to: "join", groupId: "g9" });
  });
});

describe("notification and link URLs → in-app paths", () => {
  it("keeps app paths", () => {
    expect(toAppPath("/chat/abc")).toBe("/chat/abc");
    expect(toAppPath("/home?group=g&post=p")).toBe("/home?group=g&post=p");
  });
  it("strips our own host", () => {
    expect(toAppPath("https://pactara.lovable.app/plans/build-muscle")).toBe("/plans/build-muscle");
  });
  it("reads the app's own link scheme", () => {
    expect(toAppPath("pactara://groups/g1")).toBe("/groups/g1");
  });
  it("ignores other sites and the bare root", () => {
    expect(toAppPath("https://evil.example.com/home")).toBeNull();
    expect(toAppPath("/")).toBeNull();
    expect(toAppPath("https://pactara.lovable.app/")).toBeNull();
    expect(toAppPath("//evil.example.com/x")).toBeNull();
  });
});

describe("shared-workout links at launch", () => {
  it("signed in: a /w/ link opens the shared workout, ahead of an unsigned pact", () => {
    expect(decideLaunch({ ...base, linkPath: "/w/Ab3dEf7h", pactGroupId: "g2" })).toEqual({ to: "link", href: "/w/Ab3dEf7h" });
  });
  it("signed out in the app: a /w/ link still opens (it works signed out)", () => {
    expect(decideLaunch({ ...base, signedIn: false, linkPath: "/w/Ab3dEf7h" })).toEqual({ to: "link", href: "/w/Ab3dEf7h" });
  });
  it("the universal link URL becomes the in-app path", () => {
    expect(toAppPath("https://pactara.lovable.app/w/Ab3dEf7h")).toBe("/w/Ab3dEf7h");
  });
});
