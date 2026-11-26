import { activitySection } from './profile-social';
import type { ActivityDeepLinkKind } from './activity-deeplink';

export type ActivityRow = {
  key: string; kind: ActivityDeepLinkKind; actorId: string; name: string; avatar: string | null;
  text: string; createdAt: string; read: boolean; groupId: string | null; groupName: string;
  postId: string | null; commentId: string | null; targetId: string | null;
  media: string | null; mediaKind: string | null; canFollow: boolean; canCheckIn: boolean; relationship: string;
};

export type ActivityActor = { id: string; name: string; avatar: string | null };
export type ActivityDisplayRow = ActivityRow & {
  grouped: boolean;
  groupKind: 'people' | 'posts' | null;
  groupText: string | null;
  groupActorLabel: string | null;
  actors: ActivityActor[];
};

function localDay(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function actorsFor(rows: ActivityRow[]): ActivityActor[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (seen.has(row.actorId)) return false;
    seen.add(row.actorId);
    return true;
  }).map(row => ({ id: row.actorId, name: row.name, avatar: row.avatar }));
}

function peopleLabel(actors: ActivityActor[]) {
  const first = actors[0]?.name ?? 'Someone';
  if (actors.length === 2) return `${first} and ${actors[1]?.name}`;
  return `${first} and ${actors.length - 1} others`;
}

function peopleBucket(row: ActivityRow, now: Date): string | null {
  const section = activitySection(row.createdAt, now);
  if (row.kind === 'follow') return `${section}:follow`;
  if (row.kind === 'checkin' && row.groupId) return `${section}:checkin:${row.groupId}:${localDay(row.createdAt)}`;
  if ((row.kind === 'reaction' || row.kind === 'comment') && row.postId) return `${section}:${row.kind}:${row.postId}`;
  return null;
}

function grouped(rows: ActivityRow[], groupKind: 'people' | 'posts'): ActivityDisplayRow {
  const latest = rows[0]!;
  const actors = actorsFor(rows);
  const postCount = new Set(rows.map(row => row.postId)).size;
  const actorLabel = peopleLabel(actors);
  let groupText: string;
  if (groupKind === 'posts') {
    groupText = `${latest.name} ${latest.kind === 'reaction' ? 'reacted to' : 'commented on'} ${postCount} of your check-ins`;
  } else if (latest.kind === 'follow') {
    groupText = `${actorLabel} started following you`;
  } else if (latest.kind === 'checkin') {
    groupText = `${actorLabel} checked in in ${latest.groupName}`;
  } else {
    groupText = `${actorLabel} ${latest.kind === 'reaction' ? 'reacted to' : 'commented on'} your check-in`;
  }
  return {
    ...latest,
    key: `group:${rows.map(row => row.key).join('|')}`,
    read: rows.every(row => row.read),
    canFollow: false,
    canCheckIn: false,
    relationship: 'none',
    grouped: true,
    groupKind,
    groupText,
    groupActorLabel: groupKind === 'posts' ? latest.name : actorLabel,
    actors,
  };
}

function single(row: ActivityRow): ActivityDisplayRow {
  return { ...row, grouped: false, groupKind: null, groupText: null, groupActorLabel: null, actors: actorsFor([row]) };
}

/** Groups only inside each visible time section; input may be in any order. */
export function groupActivityRows(input: ActivityRow[], now = new Date()): ActivityDisplayRow[] {
  const rows = [...input].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const used = new Set<string>();
  const output: ActivityDisplayRow[] = [];

  // First consume buckets where several people acted on one check-in/day, or followed you.
  for (const row of rows) {
    if (used.has(row.key)) continue;
    const bucket = peopleBucket(row, now);
    if (!bucket) continue;
    const matches = rows.filter(candidate => !used.has(candidate.key) && peopleBucket(candidate, now) === bucket);
    if (actorsFor(matches).length < 2) continue;
    matches.forEach(candidate => used.add(candidate.key));
    output.push(grouped(matches, 'people'));
  }

  // Then combine one person's activity across distinct check-ins you own.
  for (const row of rows) {
    if (used.has(row.key) || !row.postId || !['reaction', 'comment'].includes(row.kind) || !row.text.includes('your check-in')) continue;
    const matches = rows.filter(candidate => !used.has(candidate.key) && candidate.actorId === row.actorId && candidate.kind === row.kind
      && candidate.postId && candidate.text.includes('your check-in')
      && activitySection(candidate.createdAt, now) === activitySection(row.createdAt, now));
    if (new Set(matches.map(candidate => candidate.postId)).size < 2) continue;
    matches.forEach(candidate => used.add(candidate.key));
    output.push(grouped(matches, 'posts'));
  }

  for (const row of rows) if (!used.has(row.key)) output.push(single(row));
  return output.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
