import { beforeEach, describe, expect, it, vi } from "vitest";

// The banner is only wired up natively, and sonner is the thing we assert on.
vi.mock("@/lib/native", () => ({ isNative: () => true }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("sonner", () => ({ toast: { custom: vi.fn(), dismiss: vi.fn() } }));

import { toast } from "sonner";
import { showForegroundNotification } from "@/components/InAppNotifications";

const custom = vi.mocked(toast.custom);

/** Collects the text a banner would render, without needing a browser. */
function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  return textOf((node as { props?: { children?: unknown } }).props?.children);
}

function firstBanner(): string {
  const call = custom.mock.calls[0];
  if (!call) throw new Error("expected a banner");
  return textOf(call[0]("banner-id"));
}

beforeEach(() => {
  custom.mockClear();
});

describe("in-app notification banner", () => {
  it("shows nothing for a silent push with no title and no body", () => {
    // A badge-only push (sendBadgeUpdate) still fires notificationReceived.
    showForegroundNotification({ title: undefined, body: undefined }, vi.fn());
    showForegroundNotification({ title: "   ", body: "\n " }, vi.fn());
    expect(custom).not.toHaveBeenCalled();
  });

  it("shows the banner when a body arrives", () => {
    showForegroundNotification(
      { title: "New cheer", body: "Ravi cheered you on", data: { url: "/home?group=g1&post=p1" } },
      vi.fn(),
    );
    expect(custom).toHaveBeenCalledTimes(1);
    const text = firstBanner();
    expect(text).toContain("New cheer");
    expect(text).toContain("Ravi cheered you on");
  });

  it("keeps the Pactara title only as a fallback for a body with no title", () => {
    showForegroundNotification({ body: "Ravi cheered you on" }, vi.fn());
    expect(firstBanner()).toContain("Pactara");
    expect(firstBanner()).toContain("Ravi cheered you on");
  });

  it("clears the wrapper styling that painted the white strip", () => {
    showForegroundNotification({ body: "Ravi cheered you on" }, vi.fn());
    const options = custom.mock.calls[0]?.[1];
    expect(options?.className ?? "").toContain("bg-transparent!");
    expect(options?.className ?? "").toContain("border-0!");
    expect(options?.className ?? "").toContain("shadow-none!");
    expect(options?.className ?? "").toContain("p-0!");
    expect(options?.position).toBe("top-center");
  });
});
