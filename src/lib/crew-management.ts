import { z } from "zod";

export const crewSettingsInput = z.object({
  groupId: z.string().uuid(),
  name: z.string().trim().min(1, "Crew name required").max(80),
  about: z.string().trim().max(120, "Keep it to 120 characters").nullable(),
});
export const crewMemberActionInput = z.object({
  groupId: z.string().uuid(), memberId: z.string().uuid(), action: z.enum(["transfer", "remove"]),
});
export function requireCrewOwner(ownerId: string, userId: string) {
  if (ownerId !== userId) throw new Error("Only the person who runs this crew can do that");
}
export function joinedCrewDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}