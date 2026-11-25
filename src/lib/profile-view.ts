import { crewWeekDays, type MemberDayInputs } from './crew-today';
import { weekStartIso, weekEndIso } from './streak-rules';
import { z } from 'zod';

export function profileWeek(input: MemberDayInputs) {
  return crewWeekDays(input).map(day => ({ ...day, state: day.state === 'checked' ? 'done' as const : day.state !== 'none' ? day.state : day.date === input.today ? 'today' as const : 'future' as const }));
}
export function showProfileFreeze(today: string, eligibleDate: string | null, available: number) {
  return available > 0 && eligibleDate !== null && eligibleDate >= weekStartIso(today) && eligibleDate <= weekEndIso(today);
}
export function memberSince(createdAt: string | null | undefined) {
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) return null;
  return `Member since ${new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}
export function profileSetup(input: { joined: boolean; photo: boolean; goal: boolean; checkIns: number }) {
  const rows = [input.joined, input.photo, input.goal, input.checkIns > 0];
  const done = rows.filter(Boolean).length;
  return { rows, done, percent: done * 25, visible: done < 4 };
}
export function profileNudge(input: { blocked: boolean; covered: boolean; sent: boolean }) {
  return input.blocked ? 'hidden' : input.covered ? 'covered' : input.sent ? 'nudged' : 'allowed';
}
export const profileEditSchema = z.object({ name: z.string().trim().min(1, "Name can't be empty").max(80, 'Name must be 80 characters or fewer'), goal: z.string().trim().max(120, 'Goal must be 120 characters or fewer'), groupId: z.string().uuid().nullable() });

/** The member and crew filters are both required: another crew's goal stays unchanged. */
export async function saveProfileFields(db: { from: (table: string) => any }, userId: string, input: z.infer<typeof profileEditSchema>) {
  const data = profileEditSchema.parse(input);
  if (data.groupId) {
    const { data: membership, error } = await db.from('group_members').select('id').eq('user_id', userId).eq('group_id', data.groupId).maybeSingle();
    if (error || !membership) throw new Error('You are not a member of this crew');
    const result = await db.from('group_members').update({ personal_goal: data.goal || null, personal_goal_set_at: new Date().toISOString() }).eq('user_id', userId).eq('group_id', data.groupId);
    if (result.error) throw new Error('Could not save your goal');
  }
  const result = await db.from('profiles').update({ name: data.name }).eq('id', userId);
  if (result.error) throw new Error('Could not save your name');
}