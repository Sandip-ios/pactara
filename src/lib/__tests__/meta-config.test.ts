import { describe, expect, it } from "vitest";
import { META_APP_ID } from "@/lib/meta-config";

describe("Meta App ID", () => {
  it("is Pactara's Facebook App ID", () => {
    expect(META_APP_ID).toBe("28899098959786133");
  });
});
