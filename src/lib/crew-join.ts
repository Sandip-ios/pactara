import { z } from "zod";
import { MAX_GROUP_MEMBERS } from "./invite-resolver";

export const REQUEST_DAYS = 14;
export const JOIN_GOAL_MAX = 120;
export type RequestStatus = "pending" | "approved" | "declined" | "cancelled" | "expired";
export const crewIdInput = z.object({ groupId: z.string().uuid() });
export const requestIdInput = z.object({ requestId: z.string().uuid() });
export const decisionInput = requestIdInput.extend({ decision: z.enum(["approved", "declined"]) });
export const joinGoalInput = crewIdInput.extend({ goal: z.string().trim().max(JOIN_GOAL_MAX).nullable() });
export function effectiveRequestStatus(status: RequestStatus, createdAt: string, now = Date.now()): RequestStatus {
  return status === "pending" && now - Date.parse(createdAt) >= REQUEST_DAYS * 86400000 ? "expired" : status;
}
export function requestCanApprove(count: number, ended: boolean, blocked: boolean, status: RequestStatus) {
  return status === "pending" && !ended && !blocked && count < MAX_GROUP_MEMBERS;
}
export type DiscoveryMember = { firstName: string; avatarUrl: string | null; isOwner: boolean };
export type DiscoveryCrew = {
  id: string; name: string; about: string | null; memberCount: number; limit: number; daysPerWeek: number;
  crewStreak: number; ownerFirstName: string; members: DiscoveryMember[]; requestId: string | null; requested: boolean; isMember: boolean;
};
export type CrewWeekFilter = "any" | "3" | "4" | "5" | "6+";
export function filterDiscovery(crews: DiscoveryCrew[], week: CrewWeekFilter, open: boolean) {
  return crews.filter(c => (!open || c.memberCount < c.limit) && (week === "any" || (week === "6+" ? c.daysPerWeek >= 6 : c.daysPerWeek === Number(week))));
}
export function requestAge(createdAt: string, now = Date.now()) {
  const days = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 86400000));
  return days ? `${days}d ago` : "today";
}