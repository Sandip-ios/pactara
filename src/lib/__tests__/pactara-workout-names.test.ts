import { describe, expect, it } from "vitest";
import { PACTARA_WORKOUT_NAMES, pactaraWorkoutName } from "../pactara-workout-names";

describe("Pactara Discover workout names", () => {
  const entries = Object.entries(PACTARA_WORKOUT_NAMES);

  it("maps every approved key to a unique name", () => {
    expect(entries).toHaveLength(28);
    expect(new Set(entries.map(([key]) => key)).size).toBe(28);
    expect(new Set(entries.map(([, name]) => name)).size).toBe(28);
    for (const [key, name] of entries) expect(pactaraWorkoutName(key, "Plan day title")).toBe(name);
  });

  it("leaves unknown keys unchanged", () => {
    expect(pactaraWorkoutName("not-a-listed-key", "Plan day title")).toBe("Plan day title");
  });

  it("has no Discover Pactara name ending in A, B or C", () => {
    for (const [, name] of entries) expect(name).not.toMatch(/ [ABC]$/);
  });
});
