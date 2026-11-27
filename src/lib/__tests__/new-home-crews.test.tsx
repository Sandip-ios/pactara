import { describe, expect, it } from "vitest";
import { selectTodayState, type TodayCrewInput } from "@/lib/home-today";

const crew = (id: string): TodayCrewInput => ({
  id,
  name: id,
  checkedIn: false,
  cover: null,
  checkedInCount: 0,
  dueCount: 4,
});

describe("new Home crews", () => {
  it("keeps all five active crews in the supplied order", () => {
    const ids = ["Fourth", "Second", "Fifth", "First", "Third"];
    const result = selectTodayState({ status: "ready", crews: ids.map(crew), plan: null });
    if (result.card !== "ready") throw new Error("Expected a ready card");
    expect(result.missingCrewIds).toEqual(ids);
  });
});
