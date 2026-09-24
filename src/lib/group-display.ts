// Shared display naming for groups: labels reflect the accountability
// relationship, not the group's stored name (used on Home, Check In, etc.).
import type { PartnerState } from "@/lib/partners.functions";

export type GroupRelation = {
  kind: "partner" | "solo";
  emoji: string;
  name: string;
};

export function relationForGroup(
  groupId: string | null | undefined,
  partnerState: PartnerState | undefined | null,
): GroupRelation | null {
  if (!partnerState || !groupId) return null;
  const ps = partnerState;
  const p = ps.partnership;
  const first = p?.partner.name.split(" ")[0];
  if (p && (groupId === p.groupId || groupId === ps.soloGroupId)) {
    return p.iAccepted && p.partnerAccepted && groupId === p.groupId
      ? { kind: "partner", emoji: "🔥", name: `You + ${first}` }
      : { kind: "partner", emoji: "🤝", name: `You + ${first}` };
  }
  if (groupId === ps.soloGroupId) return { kind: "solo", emoji: "🎯", name: "My 90-Day Pact" };
  return null;
}
