import { describe, expect, it } from "vitest";
import { activityLabelFor, postShareNumbers, shareMediaKind } from "@/lib/share-post";
import { shareFileName } from "@/lib/share-card";

describe("sharing a past post uses that post's own date", () => {
  // Mon Nov 16 – Thu Nov 19 kept (Nov 17 a rest day), Sat Nov 21 and Mon Nov 23 checked in.
  const checkInDates = ["2026-11-16", "2026-11-18", "2026-11-19", "2026-11-21", "2026-11-23"];
  const coveredDates = ["2026-11-17"];

  it("streak counts back from the post's date, not today", () => {
    const n = postShareNumbers({ checkInDates, coveredDates, date: "2026-11-19", target: 5 });
    expect(n.streak).toBe(4);
  });

  it("later check-ins don't change an older post's numbers", () => {
    const n = postShareNumbers({ checkInDates, coveredDates, date: "2026-11-18", target: 5 });
    expect(n.streak).toBe(3);
    expect(n.week.done).toBe(2);
    expect(n.week.days).toEqual(["checked", "rest", "checked", "none", "none", "none", "none"]);
  });

  it("the week is the post's own Mon–Sun week with the crew's target", () => {
    const n = postShareNumbers({ checkInDates, coveredDates, date: "2026-11-21", target: 3 });
    expect(n.week).toEqual({
      done: 4,
      target: 3,
      days: ["checked", "rest", "checked", "checked", "none", "checked", "none"],
    });
    expect(n.streak).toBe(1);
  });

  it("a new week starts over", () => {
    const n = postShareNumbers({ checkInDates, coveredDates, date: "2026-11-23", target: 5 });
    expect(n.week.done).toBe(1);
  });
});

describe("photo vs video posts", () => {
  it("detects the stored media kind", () => {
    expect(shareMediaKind("g/u-checkin-1.mp4")).toBe("video");
    expect(shareMediaKind("g/u-checkin-1.MOV")).toBe("video");
    expect(shareMediaKind("g/u-checkin-1.webm")).toBe("video");
    expect(shareMediaKind("g/u-checkin-1.jpg")).toBe("photo");
    expect(shareMediaKind(null)).toBeNull();
  });

  it("photo posts save as an image file", () => {
    expect(shareFileName(12, "photo")).toBe("Pactara - Day 12.jpg");
    expect(shareFileName(12)).toBe("Pactara - Day 12.mp4");
  });

  it("names the activity tag", () => {
    expect(activityLabelFor("workout")).toBe("Workout");
    expect(activityLabelFor(null)).toBeNull();
  });
});
