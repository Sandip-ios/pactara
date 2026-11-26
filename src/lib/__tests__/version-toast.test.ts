import { describe, expect, it } from "vitest";
import { toast } from "sonner";
import { newToastApi, newToastDuration, toastForVersion } from "@/components/redesign/new-toast";

describe("version-aware toasts", () => {
  it("keeps classic on sonner and uses the new toast API only for the new version", () => {
    expect(toastForVersion("classic")).toBe(toast);
    expect(toastForVersion("new")).toBe(newToastApi);
  });

  it("keeps the existing Undo window and the shorter success window", () => {
    expect(newToastDuration(true)).toBe(5000);
    expect(newToastDuration(false)).toBe(3000);
  });
});
