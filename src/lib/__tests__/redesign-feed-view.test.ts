import { describe, expect, it } from "vitest";
import { checkInSubline, cheeredByLine, crewStreakKept, postMetaLine, redesignDayLabel } from "@/lib/redesign-feed-view";

describe("redesign posts wording", () => {
  it("drops the meal tag when a meal attachment is visible",()=>{
    const input={crew:null,time:"10:36 pm",localDate:"2026-11-27",viewerToday:"2026-11-27",tag:"Meal",crewPage:true};
    expect(checkInSubline({...input,hasCard:true})).toBe("10:36 pm");
    expect(checkInSubline({...input,hasCard:false})).toBe("10:36 pm · Meal");
  });
  it("labels days", () => {
    expect(redesignDayLabel("2026-11-26", "2026-11-26")).toBe("TODAY");
    expect(redesignDayLabel("2026-11-25", "2026-11-26")).toBe("YESTERDAY");
    expect(redesignDayLabel("2026-11-23", "2026-11-26")).toBe("MON, NOV 23");
  });
  it("crew streak kept only when nobody missed", () => {
    const base = { date: "2026-11-25", checkedIn: ["a"], rested: [], missed: [], due: 1, groupStreak: 1 };
    expect(crewStreakKept(base)).toBe(true);
    expect(crewStreakKept({ ...base, missed: ["b"] })).toBe(false);
    expect(crewStreakKept(null)).toBe(false);
  });
  it("cheered line", () => {
    const r = (firstName: string, isMe = false) => ({ firstName, isMe });
    expect(cheeredByLine([])).toBeNull();
    expect(cheeredByLine([r("Chris")])).toBe("Chris cheered");
    expect(cheeredByLine([r("You", true), r("Maya")])).toBe("Maya and you cheered");
    expect(cheeredByLine([r("Maya"), r("Chris"), r("Ana"), r("You", true)])).toBe("Maya, Chris +2 cheered");
  });
  it("meta line", () => {
    expect(postMetaLine("6:12 am", "Back day")).toBe("6:12 am · Back day");
    expect(postMetaLine("6:12 am", null)).toBe("6:12 am");
  });
});
