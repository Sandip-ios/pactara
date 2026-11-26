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