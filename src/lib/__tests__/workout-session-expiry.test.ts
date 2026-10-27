import { describe, expect, it } from "vitest";
import {
  WORKOUT_SESSION_TTL_MS,
  isWorkoutSessionStale,
} from "@/lib/workouts.functions";

// Rule: a workout session left "active" for more than 4 hours is abandoned —
// it must stop showing as "in progress" (Busi's session ran 14h overnight).
describe("workout session expiry", () => {
  const now = Date.parse("2026-10-27T16:00:00Z");

  it("expires after 4 hours", () => {
    expect(WORKOUT_SESSION_TTL_MS).toBe(4 * 60 * 60 * 1000);
  });

  it("a session started 14 hours ago is stale", () => {
    expect(isWorkoutSessionStale("2026-10-27T01:55:11Z", now)).toBe(true);
  });

  it("a session started 30 minutes ago is still live", () => {
    expect(isWorkoutSessionStale("2026-10-27T15:30:00Z", now)).toBe(false);
  });

  it("a session at exactly 4 hours is still live", () => {
    expect(isWorkoutSessionStale("2026-10-27T12:00:00Z", now)).toBe(false);
  });
});
