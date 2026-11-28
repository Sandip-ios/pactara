import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
import { notifyPostAuthor } from "../notify.server";

describe("reaction notification recipients", () => {
  beforeEach(() => {
    from.mockReset();
    from.mockImplementation((table: string) => {
      const query = {
        select: () => query,
        is: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: table === "daily_posts" ? { user_id: "owner", group_id: "crew" } : { name: "Primrose" } }),
        in: async () => ({ data: [{ user_id: "owner", push_enabled: false }] }),
      };
      return query;
    });
  });
  it("does not build or send a notification for an owner's own cheer", async () => {
    const build = vi.fn(() => ({ title: "Cheer", body: "Cheer" }));
    await notifyPostAuthor("post", "owner", build);
    expect(build).not.toHaveBeenCalled();
    expect(from.mock.calls.map(call => call[0])).toEqual(["daily_posts"]);
  });
  it("still builds the normal author notification for another reactor", async () => {
    const build = vi.fn(() => ({ title: "Cheer", body: "Cheer" }));
    await notifyPostAuthor("post", "primrose", build);
    expect(build).toHaveBeenCalledWith("Primrose");
    expect(from.mock.calls.map(call => call[0])).toContain("notification_preferences");
  });
});