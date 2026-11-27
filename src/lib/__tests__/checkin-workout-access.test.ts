import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { visibleCheckInWorkout } from "../checkin-workout.server";

const privileged = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: privileged }));
describe("check-in workout visibility boundary", () => {
  it("refuses denied check-ins before any privileged lookup", async () => {
    privileged.from.mockClear();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "Check-in unavailable" } });
    await expect(visibleCheckInWorkout({ rpc } as unknown as SupabaseClient, "blocked-checkin")).rejects.toThrow("That workout isn't available");
    expect(rpc).toHaveBeenCalledWith("get_home_checkin_social", { _id: "blocked-checkin" });
    expect(privileged.from).not.toHaveBeenCalled();
  });
  it("refuses empty workouts before any privileged linkage lookup", async () => {
    privileged.from.mockClear();
    const rpc = vi.fn().mockResolvedValue({ data: { workoutDetail: { exercises: [] } }, error: null });
    await expect(visibleCheckInWorkout({ rpc } as unknown as SupabaseClient, "empty-checkin")).rejects.toThrow("That workout isn't available");
    expect(privileged.from).not.toHaveBeenCalled();
  });
});