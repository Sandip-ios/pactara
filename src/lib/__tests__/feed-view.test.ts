import { describe, expect, it } from "vitest";
import {
  cheerSentence,
  checkInMetaLine,
  dayHeaderLabel,
  feedDayNumber,
  quietDayLine,
  showQuickReplies,
  type Reactor,
} from "../feed-view";
import { buildFeedDays, mergeFeedPages } from "../feed-days";
import type { FeedItem, FeedMember, FeedMeta, GroupFeedPage, TimelineNode } from "../daily-posts.functions";

const r = (firstName: string, isMe = false): Reactor => ({
  userId: firstName,
  name: firstName,
  firstName,
  avatarUrl: null,
  avatarColor: "#000",
  emoji: "🔥",
  isMe,
});

describe("who cheered sentence", () => {
  it("names two people on someone else's post", () => {
    expect(cheerSentence([r("Michele"), r("Busi")], false)).toBe("Michele, Busi");
  });
  it("puts you first and counts the rest", () => {
    expect(cheerSentence([r("Michele"), r("Busi"), r("Jose", true)], false)).toBe("You, Michele +1");
  });
  it("names a single cheerer", () => {
    expect(cheerSentence([r("Bertille")], false)).toBe("Bertille");
  });
  it("invites the first cheer when nobody has", () => {
    expect(cheerSentence([], false)).toBe("Be the first to cheer");
  });
  it("counts cheers on your own post", () => {
    expect(cheerSentence([r("Michele"), r("Busi"), r("Guy")], true)).toBe("3 cheered you on");
    expect(cheerSentence([], true)).toBe("No cheers yet");
  });
});

describe("Day n on a check-in card", () => {
  it("counts consecutive kept days up to the post's date, rest days included", () => {
    // Thu, Fri check-ins, Sat rest, Sun check-in → Day 4 on Sunday's post.
    expect(feedDayNumber(["2026-11-19", "2026-11-20", "2026-11-22"], ["2026-11-21"], "2026-11-22")).toBe(4);
  });
  it("is the streak as of that post, ignoring later days", () => {
    const checkIns = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
    expect(feedDayNumber(checkIns, [], "2026-11-17")).toBe(2);
  });
  it("restarts after a missed day", () => {
    expect(feedDayNumber(["2026-11-18", "2026-11-20", "2026-11-21"], [], "2026-11-21")).toBe(2);
  });
  it("shows Day n in the meta line, activity only when tagged", () => {
    expect(checkInMetaLine("workout", 12, "5:27 am")).toBe("💪 Workout · Day 12 · 5:27 am");
    expect(checkInMetaLine(null, 3, "7:02 pm")).toBe("Day 3 · 7:02 pm");
  });
});

describe("day headers", () => {
  const today = "2026-11-22"; // Sunday
  it("reads Today · weekday, Yesterday · weekday, then weekday · date for every older day", () => {
    expect(dayHeaderLabel("2026-11-22", today)).toBe("Today · Sunday");
    expect(dayHeaderLabel("2026-11-21", today)).toBe("Yesterday · Saturday");
    expect(dayHeaderLabel("2026-11-16", today)).toBe("Monday · Nov 16");
    expect(dayHeaderLabel("2026-11-20", today)).toBe("Friday · Nov 20");
    expect(dayHeaderLabel("2026-11-03", today)).toBe("Tuesday · Nov 3");
  });
});

describe("feed days", () => {
  const today = "2026-11-22"; // Sunday
  const person = (userId: string, firstName: string, isMe = false): FeedMember => ({
    userId,
    name: firstName,
    firstName,
    avatarUrl: null,
    avatarColor: "#000",
    isMe,
  });
  const crew = [person("me", "Jose", true), person("m", "Michele"), person("g", "Guy"), person("b", "Bertille")];
  const post = (id: string, userId: string, localDate: string, nodes: TimelineNode[]): FeedItem => ({
    id,
    groupId: "g1",
    userId,
    isMe: userId === "me",
    name: crew.find((c) => c.userId === userId)?.name ?? "Ana",
    avatarColor: "#000",
    avatarUrl: null,
    localDate,
    updatedAt: `${localDate}T12:00:00Z`,
    nodes,
    reactions: [],
    reactors: [],
    commentCount: 0,
    lastCommentAt: null,
    latestComment: null,
    dayNumber: 1,
    weekCount: 1,
  });
  const checkIn = (id: string, userId: string, localDate: string) =>
    post(id, userId, localDate, [
      { kind: "check_in", id: `c-${id}`, mood: null, activity: null, note: null, photoUrl: null, at: `${localDate}T12:00:00Z` },
    ]);
  const missed = (id: string, userId: string, localDate: string) =>
    post(id, userId, localDate, [
      { kind: "check_in_missed", id: `cm-${id}`, at: `${localDate}T23:59:00Z`, localDate, memberToday: today },
    ]);
  const rested = (id: string, userId: string, localDate: string) =>
    post(id, userId, localDate, [
      { kind: "rested", id: `rest-${id}`, at: `${localDate}T23:59:00Z`, localDate, memberToday: today },
    ]);
  const meta = (over: Partial<FeedMeta> = {}): FeedMeta => ({
    viewerToday: today,
    weeklyTarget: 5,
    members: crew,
    days: [],
    notYet: [],
    milestones: [],
    ...over,
  });

  it("lists every day newest first with all of its check-in cards", () => {
    const days = buildFeedDays(
      [checkIn("a", "m", "2026-11-12"), checkIn("b", "g", "2026-11-22"), checkIn("c", "b", "2026-11-21"), checkIn("d", "g", "2026-11-12")],
      meta(),
      today,
    );
    expect(days.map((d) => d.date)).toEqual(["2026-11-22", "2026-11-21", "2026-11-12"]);
    expect(days[2]?.entries.filter((e) => e.kind === "checkins")).toHaveLength(2);
  });

  it("combines a past day's missed and rested people into one row, missed first", () => {
    const days = buildFeedDays(
      [
        checkIn("a", "b", "2026-11-20"),
        missed("b", "m", "2026-11-20"),
        missed("c", "me", "2026-11-20"),
        missed("d", "g", "2026-11-20"),
      ],
      meta({ days: [{ date: "2026-11-20", checkedIn: ["b"], rested: [], missed: [], due: 4, groupStreak: 0 }] }),
      today,
    );
    const entries = days[0]?.entries ?? [];
    expect(entries.map((e) => e.kind)).toEqual(["checkins", "quiet"]);
    const quiet = entries[1];
    if (quiet?.kind !== "quiet") throw new Error("no quiet row");
    expect(quietDayLine(quiet.missed, quiet.rested)).toBe("Guy, Michele and you missed");
  });

  it("adds rest days from the crew's day stats even without a post", () => {
    const days = buildFeedDays(
      [missed("a", "m", "2026-11-19")],
      meta({ days: [{ date: "2026-11-19", checkedIn: [], rested: ["b"], missed: ["m"], due: 3, groupStreak: 0 }] }),
      today,
    );
    expect(days).toHaveLength(1);
    const quiet = days[0]?.entries[0];
    if (quiet?.kind !== "quiet") throw new Error("no quiet row");
    expect(quietDayLine(quiet.missed, quiet.rested)).toBe("Michele missed · Bertille rested");
  });

  it("shows a day where nobody checked in as just that one quiet row", () => {
    const days = buildFeedDays([missed("a", "m", "2026-11-18"), rested("b", "me", "2026-11-18")], meta(), today);
    expect(days[0]?.label).toBe("Wednesday · Nov 18");
    expect(days[0]?.entries.map((e) => e.kind)).toEqual(["quiet"]);
  });

  it("keeps one row per person today", () => {
    const days = buildFeedDays(
      [missed("a", "m", today), rested("b", "b", today), checkIn("c", "me", today)],
      meta({ notYet: [{ userId: "g", closesAt: "2026-11-23T06:00:00Z", nudgedAt: null }] }),
      today,
    );
    expect(days[0]?.entries.map((e) => e.kind)).toEqual(["checkins", "not_yet", "rested", "missed"]);
  });

  it("keeps milestone rows individual on past days", () => {
    const days = buildFeedDays(
      [checkIn("a", "m", "2026-11-17"), missed("b", "g", "2026-11-17")],
      meta({
        milestones: [
          { id: "x", userId: "m", streakDays: 7, localDate: "2026-11-17", postId: "a" },
          { id: "y", userId: "b", streakDays: 3, localDate: "2026-11-17", postId: null },
        ],
      }),
      today,
    );
    expect(days[0]?.entries.map((e) => e.kind)).toEqual(["milestone", "milestone", "checkins", "quiet"]);
  });

  it("files a post from a member already on tomorrow under Today", () => {
    const days = buildFeedDays([checkIn("a", "m", "2026-11-23")], meta(), today);
    expect(days[0]?.date).toBe(today);
    expect(days[0]?.label).toBe("Today · Sunday");
  });

  it("joins loaded weeks into one feed, today's rows from the newest week only", () => {
    const first: GroupFeedPage = {
      items: [checkIn("a", "m", "2026-11-22")],
      meta: meta({ notYet: [{ userId: "g", closesAt: "x", nudgedAt: null }], days: [{ date: "2026-11-22", checkedIn: ["m"], rested: [], missed: [], due: 4, groupStreak: 1 }] }),
      nextBefore: "2026-11-16",
    };
    const second: GroupFeedPage = {
      items: [checkIn("b", "g", "2026-11-12")],
      meta: meta({ members: [...crew, person("z", "Zoe")], days: [{ date: "2026-11-12", checkedIn: ["g"], rested: [], missed: [], due: 4, groupStreak: 0 }] }),
      nextBefore: null,
    };
    const merged = mergeFeedPages([first, second]);
    expect(merged.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(merged.meta?.days.map((d) => d.date)).toEqual(["2026-11-22", "2026-11-12"]);
    expect(merged.meta?.notYet).toHaveLength(1);
    expect(merged.meta?.members.map((m) => m.userId)).toContain("z");
  });
});

describe("past-day quiet row wording", () => {
  const p = (firstName: string, isMe = false) => ({ firstName, isMe });
  it("puts you last in lowercase and missed before rested", () => {
    expect(quietDayLine([p("Michele"), p("Jose", true), p("Guy")], [p("Bertille")])).toBe(
      "Michele, Guy and you missed · Bertille rested",
    );
  });
  it("capitalises You only when it opens the line", () => {
    expect(quietDayLine([p("Jose", true)], [])).toBe("You missed");
    expect(quietDayLine([p("Guy")], [p("Jose", true)])).toBe("Guy missed · you rested");
    expect(quietDayLine([], [p("Jose", true)])).toBe("You rested");
  });
});

describe("quick replies", () => {
  it("only show on someone else's post with no cheers or comments", () => {
    expect(showQuickReplies({ ownPost: false, cheers: 0, comments: 0 })).toBe(true);
    expect(showQuickReplies({ ownPost: true, cheers: 0, comments: 0 })).toBe(false);
    expect(showQuickReplies({ ownPost: false, cheers: 1, comments: 0 })).toBe(false);
    expect(showQuickReplies({ ownPost: false, cheers: 0, comments: 1 })).toBe(false);
  });
});
