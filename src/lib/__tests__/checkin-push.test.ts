import { describe, expect, it } from "vitest";
import { checkInPushText } from "../checkin-push";

describe("checkInPushText", () => {
  it("titles the push with first name and crew name", () => {
    expect(checkInPushText("Jose Togbe", "Morning Crew", null)).toEqual({ title: "Jose · Morning Crew", body: "Checked in" });
  });
  it("adds the activity label and emoji when tagged", () => {
    expect(checkInPushText("Jose", "Crew", "workout").body).toBe("Checked in: Workout 💪");
    expect(checkInPushText("Jose", "Crew", "run").body).toBe("Checked in: Run 🏃");
    expect(checkInPushText("Jose", "Crew", "yoga").body).toBe("Checked in: Yoga");
  });
  it("falls back to just the first name without a crew name", () => {
    expect(checkInPushText("Jose", "", null).title).toBe("Jose");
  });
});
