import { describe, expect, it } from "vitest";
import { discoverableOnCreate, shownInFindACrew } from "../crew-discovery-rules";

const classic = { new_version_enabled: false, app_version: "classic" };
const enabledButClassic = { new_version_enabled: true, app_version: "classic" };
const fresh = { new_version_enabled: true, app_version: "new" };

describe("crew discovery by creator version", () => {
  it("crews created from classic are never discoverable", () => {
    expect(discoverableOnCreate(classic, true)).toBe(false);
    expect(discoverableOnCreate(enabledButClassic, true)).toBe(false);
    expect(discoverableOnCreate(null, undefined)).toBe(false);
  });
  it("crews created from the new version default to discoverable", () => {
    expect(discoverableOnCreate(fresh, undefined)).toBe(true);
    expect(discoverableOnCreate(fresh, false)).toBe(false);
  });
  it("Find a crew hides discoverable crews whose owner is not on the new version", () => {
    expect(shownInFindACrew(true, classic)).toBe(false);
    expect(shownInFindACrew(true, enabledButClassic)).toBe(false);
    expect(shownInFindACrew(true, fresh)).toBe(true);
    expect(shownInFindACrew(false, fresh)).toBe(false);
  });
});
