export type SocialPerson = {
  id: string; name: string; username: string | null; avatar: string | null;
  relationship: string; canFollow: boolean; sharedCrew: string | null; isSelf: boolean;
};

export const SOCIAL_PAGE_SIZE = 30;

/** The existing mark-read action accepts at most 500 keys per call. */
export function activityReadBatches(keys: string[]) {
  const unique = [...new Set(keys)];
  const batches: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += 500) batches.push(unique.slice(offset, offset + 500));
  return batches;
}

export function filterSocialPeople<T extends Pick<SocialPerson, 'name' | 'username'>>(people: T[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return people.filter(person => !query || person.name.toLocaleLowerCase().includes(query) || (person.username ?? '').toLocaleLowerCase().includes(query));
}

export function socialFollowAction(person: Pick<SocialPerson, 'isSelf' | 'canFollow' | 'relationship'>) {
  if (person.isSelf) return null;
  if (person.relationship === 'following') return 'Following';
  if (person.relationship === 'requested') return 'Requested';
  return person.canFollow ? 'Follow' : null;
}

export function activitySection(iso: string, now = new Date()) {
  const date = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
  return date >= today ? 'TODAY' : date >= monday ? 'THIS WEEK' : 'EARLIER';
}

export function activityTime(iso: string, now = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function requestSummary(firstName: string, total: number) {
  return total <= 1 ? firstName : `${firstName} and ${total - 1} ${total === 2 ? 'other' : 'others'}`;
}