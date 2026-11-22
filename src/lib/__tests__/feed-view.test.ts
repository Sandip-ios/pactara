import { describe, expect, it } from "vitest";
import {
  cheerSentence,
  checkInMetaLine,
  dayHeaderLabel,
  daySummary,
  feedDayNumber,
  isCollapsedDay,
  showQuickReplies,
  type Reactor,
} from "../feed-view";
import { buildFeedDays } from "../feed-days";
import type { FeedItem, FeedMeta } from "../daily-posts.functions";

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

describe("day collapsing", () => {
  const today = "2026-11-22"; // Sunday
  it("keeps today and yesterday open and collapses older days", () => {
    expect(isCollapsedDay("2026-11-22", today)).toBe(false);
    expect(isCollapsedDay("2026-11-21", today)).toBe(false);
    expect(isCollapsedDay("2026-11-20", today)).toBe(true);
    expect(isCollapsedDay("2026-11-10", today)).toBe(true);
  });
  it("labels the day headers", () => {
    expect(dayHeaderLabel("2026-11-22", today)).toBe("Today · Sunday");
    expect(dayHeaderLabel("2026-11-21", today)).toBe("Yesterday · Saturday");
    expect(dayHeaderLabel("2026-11-19", today)).toBe("Thursday");
  });

  const item = (id: string, localDate: string): FeedItem => ({
    id,
    groupId: "g",
    userId: "u1",
    isMe: false,
    name: "Ana",
    avatarColor: "#000",
    avatarUrl: null,
    localDate,
    updatedAt: `${localDate}T12:00:00Z`,
    nodes: [
      { kind: "check_in", id: `c-${id}`, mood: null, activity: null, note: null, photoUrl: null, at: `${localDate}T12:00:00Z` },
    ],
    reactions: [],
    reactors: [],
    commentCount: 0,
    lastCommentAt: null,
    latestComment: null,
    dayNumber: 1,
    weekCount: 1,
  });
  const meta: FeedMeta = { viewerToday: today, weeklyTarget: 5, members: [], days: [], notYet: [], milestones: [] };

  it("builds newest day first with only older days collapsed", () => {
    const days = buildFeedDays([item("a", "2026-11-20"), item("b", "2026-11-22"), item("c", "2026-11-21")], meta, today);
    expect(days.map((d) => [d.date, d.collapsed])).toEqual([
      ["2026-11-22", false],
      ["2026-11-21", false],
      ["2026-11-20", true],
    ]);
  });
  it("files a post from a member already on tomorrow under Today", () => {
    const days = buildFeedDays([item("a", "2026-11-23")], meta, today);
    expect(days[0]?.date).toBe(today);
    expect(days[0]?.collapsed).toBe(false);
  });
});

describe("collapsed day summary", () => {
  const people: Record<string, { firstName: string; isMe: boolean }> = {
    me: { firstName: "Jose", isMe: true },
    b: { firstName: "Bertille", isMe: false },
    m: { firstName: "Michele", isMe: false },
    g: { firstName: "Guy", isMe: false },
  };
  const nameOf = (id: string) => people[id] ?? { firstName: "Member", isMe: false };
  it("reads everyone showed up when all members due checked in", () => {
    const s = daySummary({ date: "d", checkedIn: ["me", "b", "g"], rested: ["m"], missed: [], due: 3, groupStreak: 4 }, nameOf);
    expect(s.everyoneIn).toBe(true);
    expect(s.title).toBe("Everyone showed up");
  });
  it("names who checked in, rested and missed on a mixed day", () => {
    const s = daySummary({ date: "d", checkedIn: ["b", "me"], rested: ["m"], missed: ["g"], due: 3, groupStreak: 0 }, nameOf);
    expect(s.everyoneIn).toBe(false);
    expect(s.title).toBe("Bertille and you checked in");
    expect(s.subline).toBe("Michele rested · Guy missed");
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
