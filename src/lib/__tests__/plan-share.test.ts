import { describe, expect, it } from "vitest";
import {
  chatPlanShareLabel,
  crewsSentPlan,
  isPlanSlug,
  planMetaLine,
  planOgDescription,
  planOgImage,
  planShareText,
  planShareTitle,
  planShareUrl,
  planSharePushText,
  weekOnePreview,
} from "@/lib/plan-share";
import { isPublicLinkPath } from "@/lib/launch-route";

const buildMuscle = { weeks: 8, daysPerWeek: 5, minutes: "40" };

describe("plan share link and share sheet", () => {
  it("links to /p/<slug> on pactara.lovable.app, naming the sharer's code", () => {
    expect(planShareUrl("build-muscle", "Ab3dEf7h")).toBe("https://pactara.lovable.app/p/build-muscle?from=Ab3dEf7h");
    expect(planShareUrl("build-muscle", null)).toBe("https://pactara.lovable.app/p/build-muscle");
  });
  it("share sheet title and text", () => {
    expect(planShareTitle("Build Muscle")).toBe("Build Muscle · Pactara");
    expect(planShareText("Build Muscle")).toBe("Try the Build Muscle plan with me on Pactara");
  });
  it("accepts only plan-like slugs", () => {
    expect(isPlanSlug("first-5k")).toBe(true);
    expect(isPlanSlug("Build Muscle")).toBe(false);
    expect(isPlanSlug("../x")).toBe(false);
  });
});

describe("plan size wording", () => {
  it("panel, chat card: 8 weeks · 5 days a week · 40 min", () => {
    expect(planMetaLine(buildMuscle)).toBe("8 weeks · 5 days a week · 40 min");
    expect(planMetaLine({ weeks: 4, daysPerWeek: 5, minutes: "20–35" })).toBe("4 weeks · 5 days a week · 20–35 min");
  });
  it("link preview description", () => {
    expect(planOgDescription(buildMuscle)).toBe("8 weeks · 5 days a week · 40 min. Free on Pactara.");
  });
  it("link preview image is the cover cropped to 1200×630", () => {
    const img = planOgImage("https://images.unsplash.com/photo-1?w=1200&q=70&fit=crop&auto=format")!;
    const u = new URL(img);
    expect(u.searchParams.get("w")).toBe("1200");
    expect(u.searchParams.get("h")).toBe("630");
    expect(u.searchParams.get("fit")).toBe("crop");
    expect(planOgImage(null)).toBeNull();
    expect(planOgImage("/covers/x.jpg")).toBeNull();
  });
});

describe("plan in a crew chat", () => {
  it("labels and push text", () => {
    expect(chatPlanShareLabel("Ana", false)).toBe("Ana shared a plan");
    expect(chatPlanShareLabel("Ana", true)).toBe("You shared a plan");
    expect(planSharePushText("Ana", "Build Muscle")).toBe("Ana shared a plan: Build Muscle");
  });
  it("a crew that got the plan stays Sent (no duplicate)", () => {
    expect(
      crewsSentPlan(
        [
          { groupId: "g1", slug: "build-muscle" },
          { groupId: "g1", slug: "build-muscle" },
          { groupId: "g2", slug: "lose-fat" },
        ],
        "build-muscle",
      ),
    ).toEqual(["g1"]);
  });
});

describe("public plan page", () => {
  it("week 1 preview lists the first three day names in order", () => {
    expect(
      weekOnePreview([
        { dayNumber: 3, weekNumber: null, title: "Legs" },
        { dayNumber: 1, weekNumber: null, title: "Push" },
        { dayNumber: 4, weekNumber: null, title: "Arms" },
        { dayNumber: 2, weekNumber: null, title: "Pull" },
      ]),
    ).toEqual(["Push", "Pull", "Legs"]);
  });
  it("plans with per-week days use week 1 only", () => {
    expect(
      weekOnePreview([
        { dayNumber: 1, weekNumber: 2, title: "Run 2" },
        { dayNumber: 1, weekNumber: 1, title: "Run 1" },
        { dayNumber: 2, weekNumber: 1, title: "Walk 1" },
      ]),
    ).toEqual(["Run 1", "Walk 1"]);
  });
  it("/p/ links open signed out at launch, like /w/", () => {
    expect(isPublicLinkPath("/p/build-muscle")).toBe(true);
    expect(isPublicLinkPath("/p/build-muscle?from=Ab3dEf7h")).toBe(true);
    expect(isPublicLinkPath("/plans/build-muscle")).toBe(false);
  });
});
