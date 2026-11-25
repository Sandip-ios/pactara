import { describe, expect, it } from "vitest";
import { parseVersionParam, previewOverrideAllowed, resolveAppVersion } from "../app-version";

describe("resolveAppVersion", () => {
  it("is new only when enabled and picked new", () => {
    expect(resolveAppVersion(true, "new")).toBe("new");
    expect(resolveAppVersion(false, "new")).toBe("classic");
    expect(resolveAppVersion(true, "classic")).toBe("classic");
    expect(resolveAppVersion(undefined, undefined)).toBe("classic");
  });
  it("preview override wins", () => {
    expect(resolveAppVersion(false, "classic", "new")).toBe("new");
    expect(resolveAppVersion(true, "new", "classic")).toBe("classic");
  });
  it("override only on preview hosts, never the published app", () => {
    expect(previewOverrideAllowed("id-preview-1--abc.lovable.app")).toBe(true);
    expect(previewOverrideAllowed("pactara.lovable.app")).toBe(false);
  });
  it("parses ?v=", () => {
    expect(parseVersionParam("?v=new")).toBe("new");
    expect(parseVersionParam("?v=classic")).toBe("classic");
    expect(parseVersionParam("?v=x")).toBeNull();
  });
});
