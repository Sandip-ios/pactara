import { describe, expect, it } from "vitest";
import { crewSettingsInput, requireCrewOwner, crewMemberActionInput } from "../crew-management";
const groupId = "6ae2e5e9-dd8a-4c0a-a8b1-4197424ad5b8";
describe("crew management rules", () => {
  it("accepts 120 about characters and rejects 121", () => {
    expect(crewSettingsInput.parse({ groupId, name: "QA Crew", about: "a".repeat(120) }).about?.length).toBe(120);
    expect(() => crewSettingsInput.parse({ groupId, name: "QA Crew", about: "a".repeat(121) })).toThrow();
  });
  it("allows a nullable description", () => {
    expect(crewSettingsInput.parse({ groupId, name: "QA Crew", about: null }).about).toBeNull();
  });
  it("only allows the current owner to save", () => {
    expect(() => requireCrewOwner("owner", "member")).toThrow("Only the person");
    expect(() => requireCrewOwner("owner", "owner")).not.toThrow();
  });
  it("limits member actions to transfer and removal", () => {
    expect(crewMemberActionInput.safeParse({ groupId, memberId: groupId, action: "delete" }).success).toBe(false);
    expect(crewMemberActionInput.parse({ groupId, memberId: groupId, action: "transfer" }).action).toBe("transfer");
  });
});