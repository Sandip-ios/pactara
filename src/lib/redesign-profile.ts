import { z } from 'zod';
import { redesignWeekCell } from './redesign-crew-view';
import type { HomeCrewMember } from './home-crew.functions';

export const USERNAME_ERROR = 'Use 3 to 30 letters, numbers, periods or underscores';
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,30}$/, USERNAME_ERROR);
export const newProfileEditSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty").max(50, 'Use 1 to 50 characters'),
  username: usernameSchema,
  bio: z.string().trim().max(150, 'Use 150 characters or fewer'),
});

export function newProfileChanged(original: { name: string; username: string | null; bio: string | null }, draft: { name: string; username: string; bio: string }, photoChanged: boolean) {
  return photoChanged || draft.name.trim() !== original.name || draft.username.trim().toLowerCase() !== (original.username ?? '') || draft.bio.trim() !== (original.bio ?? '');
}

/** Same check-in, rest and freeze states as the new crew page, not a new date loop. */
export function newProfileWeek(member: Pick<HomeCrewMember, 'days' | 'today' | 'coverKinds'>) {
  return member.days.map(day => {
    const cover = member.coverKinds.find(item => item.date === day.date);
    return { date: day.date, state: redesignWeekCell({ ...day, today: member.today, ...(cover ? { coverKind: cover.kind } : {}) }) };
  });
}

export async function saveNewProfileFields(db: { from: (table: 'profiles') => any }, userId: string, input: z.infer<typeof newProfileEditSchema>) {
  const data = newProfileEditSchema.parse(input);
  const result = await db.from('profiles').update({ name: data.name, username: data.username, bio: data.bio || null }).eq('id', userId);
  if (result.error) {
    if (result.error.code === '23505') throw new Error('That username is taken');
    throw new Error('Could not save profile');
  }
}
/** Own-profile streak line: only parts above 0, joined with " · "; empty when both are 0. */
export function progressSummary(streak: number, badges: number): string {
  const parts: string[] = [];
  if (streak > 0) parts.push(`${streak}-day streak`);
  if (badges > 0) parts.push(`${badges} ${badges === 1 ? 'badge' : 'badges'}`);
  return parts.join(' · ');
}

/** This week card chips: a 0-day streak is never shown, freezes only when the count is known. */
export function profileWeekChips(streak: number | null | undefined, freezes: number | null): { streak: boolean; freezes: boolean; any: boolean; single: boolean } {
  const showStreak = (streak ?? 0) > 0;
  const showFreezes = freezes !== null;
  return { streak: showStreak, freezes: showFreezes, any: showStreak || showFreezes, single: showStreak !== showFreezes };
}

export type MemberRelationship = 'none' | 'requested' | 'following' | 'follows_you' | 'blocked';
export type MemberFollowButton = 'follow' | 'follow_back' | 'requested' | 'following' | null;

/** Which follow button someone else's profile shows (null: no follow button). */
export function memberFollowButton(relationship: MemberRelationship, followsMe: boolean, canFollow: boolean): MemberFollowButton {
  if (relationship === 'blocked') return null;
  if (relationship === 'following') return 'following';
  if (relationship === 'requested') return 'requested';
  if (!canFollow) return null;
  return followsMe || relationship === 'follows_you' ? 'follow_back' : 'follow';
}

/** What sits under the white section: crew week card, the private card, or nothing. */
export function memberProfileBody(input: { relationship: MemberRelationship; isPrivate: boolean; sharedCrews: number }): 'blocked' | 'week' | 'private' | 'none' {
  if (input.relationship === 'blocked') return 'blocked';
  if (input.sharedCrews > 0) return 'week';
  if (input.isPrivate && input.relationship !== 'following') return 'private';
  return 'none';
}

export function followedByLine(firstName: string | null, total: number): string | null {
  if (!firstName || total < 1) return null;
  const others = total - 1;
  return others === 0 ? `Followed by ${firstName}` : `Followed by ${firstName} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

export function blockConfirmBody(firstName: string, sharedCrewName: string | null): string {
  const base = `${firstName} won't see your profile or be able to message or follow you, and you won't see theirs. They aren't told.`;
  return sharedCrewName ? `${base} You'll both stay in ${sharedCrewName}.` : base;
}

export function memberFirstName(name: string, username: string | null): string {
  return name.trim().split(/\s+/)[0] || username || 'Member';
}

/** Under 18 by birthday (local calendar date). Matches the database's teen-privacy rule. */
export function isUnder18(birthday: string | null | undefined, today: Date = new Date()): boolean {
  if (!birthday) return false;
  const [y, m, d] = birthday.split('-').map(Number);
  if (!y || !m || !d) return false;
  const eighteenth = new Date(y + 18, m - 1, d);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return t < eighteenth;
}

export function switchPublicBody(pending: number): string {
  const base = 'Anyone can see your profile and follow you.';
  return pending > 0 ? `${base} People with pending requests (${pending}) will follow you automatically.` : base;
}

export function blockedOnLabel(createdAt: string): string {
  return `Blocked ${new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/** What blocking does today (profile, check-ins, crew chat, follows, nudges are all enforced). */
export const BLOCKING_EXPLAINER = "They can't see your profile, check-ins or crew messages, and they can't follow or nudge you. They aren't told.";
