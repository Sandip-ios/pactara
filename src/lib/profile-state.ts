/**
 * New-version profile (canvas 51c): which header buttons, action buttons and
 * content a profile shows for the viewer/target relationship. Pure, no React.
 */
export type FollowState = 'none' | 'requested' | 'following';

export type ProfileStateInput =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unavailable' }
  | { status: 'own' }
  | {
      status: 'other';
      iBlocked: boolean;
      isPrivate: boolean;
      under18: boolean;
      follow: FollowState;
      followsMe: boolean;
      canFollow: boolean;
      sharedCrews: number;
      /** They haven't checked in today in a shared crew where they're expected today. */
      nudgeable: boolean;
    };

export type ProfileButton = 'edit' | 'share' | 'follow' | 'follow_back' | 'following' | 'requested' | 'nudge' | 'unblock';
export type ProfileContent = 'tabs' | 'locked' | 'blocked' | 'unavailable' | 'skeleton' | 'error';

export type ProfileState = {
  header: { left: 'none' | 'back'; right: 'menu' | 'more' | 'none' };
  buttons: ProfileButton[];
  content: ProfileContent;
  /** Private crewmate: "You see X's check-ins in Crew" row inside the lock card. */
  crewLink: boolean;
  /** Info line ends with "· Follows you". */
  followsYou: boolean;
  /** Stats row and info section are shown. */
  showInfo: boolean;
};

const base = { crewLink: false, followsYou: false, showInfo: true };

export function profileState(input: ProfileStateInput): ProfileState {
  switch (input.status) {
    case 'loading': return { ...base, header: { left: 'back', right: 'none' }, buttons: [], content: 'skeleton', showInfo: false };
    case 'error': return { ...base, header: { left: 'back', right: 'none' }, buttons: [], content: 'error', showInfo: false };
    case 'unavailable': return { ...base, header: { left: 'back', right: 'none' }, buttons: [], content: 'unavailable', showInfo: false };
    case 'own': return { ...base, header: { left: 'none', right: 'menu' }, buttons: ['edit', 'share'], content: 'tabs' };
    case 'other': {
      if (input.iBlocked) return { ...base, header: { left: 'back', right: 'more' }, buttons: ['unblock'], content: 'blocked' };
      const priv = input.isPrivate || input.under18;
      const follow: ProfileButton | null = input.follow === 'following' ? 'following'
        : input.follow === 'requested' ? 'requested'
        : !input.canFollow ? null
        : input.followsMe ? 'follow_back' : 'follow';
      const second: ProfileButton = input.sharedCrews > 0 && input.nudgeable ? 'nudge' : 'share';
      const locked = priv && input.follow !== 'following';
      return {
        header: { left: 'back', right: 'more' },
        // Locked, not a crewmate: one full-width follow button, no Share profile.
        buttons: locked && input.sharedCrews === 0 && follow ? [follow] : follow ? [follow, second] : [second],
        content: locked ? 'locked' : 'tabs',
        crewLink: locked && input.sharedCrews > 0,
        followsYou: follow === 'follow_back',
        showInfo: true,
      };
    }
  }
}

/** "In FitFam with you", "In FitFam +1 with you"; null when no shared crew. */
export function sharedCrewLabel(names: readonly string[]): string | null {
  const first = names[0];
  if (!first) return null;
  return names.length > 1 ? `In ${first} +${names.length - 1} with you` : `In ${first} with you`;
}

/** Others' info line parts (shown joined with " · "). */
/** One info-line segment; the icon is drawn as a line icon, never an emoji. */
export type InfoPart = { icon: 'users' | 'flame' | null; text: string };

export function memberInfoParts(input: { crewNames: readonly string[]; streak: number | null; followsYou: boolean; followedBy: string | null }): InfoPart[] {
  const parts: InfoPart[] = [];
  const crew = sharedCrewLabel(input.crewNames);
  if (crew) parts.push({ icon: 'users', text: crew });
  if ((input.streak ?? 0) > 0) parts.push({ icon: 'flame', text: `${input.streak}-day streak` });
  if (!crew && input.followedBy) parts.push({ icon: null, text: input.followedBy });
  if (input.followsYou) parts.push({ icon: null, text: 'Follows you' });
  return parts;
}

/** Own info line: [flame] 18-day streak · 4 badges (zero parts left out). */
export function ownInfoLine(streak: number, badges: number): InfoPart[] {
  const parts: InfoPart[] = [];
  if (streak > 0) parts.push({ icon: 'flame', text: `${streak}-day streak` });
  if (badges > 0) parts.push({ icon: null, text: `${badges} ${badges === 1 ? 'badge' : 'badges'}` });
  return parts;
}

/** "1 post", "2 followers", "1 following" style stat labels. */
export function statLabel(kind: 'posts' | 'followers' | 'following', n: number): string {
  if (kind === 'following') return 'following';
  return n === 1 ? kind.slice(0, -1) : kind;
}

export type ProfileWorkoutRow = { id: string; code: string | null; name: string; exercises: number; minutes: number; fromName: string | null; saves: number; muscle: string; myCopyId: string | null };

/** "6 exercises · 45 min · from Maya Lindqvist · saved 3 times" */
export function workoutMeta(w: Pick<ProfileWorkoutRow, 'exercises' | 'minutes' | 'fromName' | 'saves'>, own: boolean): string {
  const parts = [`${w.exercises} ${w.exercises === 1 ? 'exercise' : 'exercises'}`];
  if (w.minutes > 0) parts.push(`${w.minutes} min`);
  if (own && w.fromName) parts.push(`from ${w.fromName}`);
  if (w.saves > 0) parts.push(own ? `saved ${w.saves} ${w.saves === 1 ? 'time' : 'times'}` : `${w.saves} ${w.saves === 1 ? 'save' : 'saves'}`);
  return parts.join(' · ');
}

/** Others' Workouts tab: groups by main muscle, biggest group first, then name. */
export function groupByMuscle<T extends { muscle: string; name: string }>(rows: readonly T[]): { muscle: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.muscle, [...(map.get(r.muscle) ?? []), r]);
  return [...map.entries()].map(([muscle, items]) => ({ muscle, items })).sort((a, b) => b.items.length - a.items.length || a.muscle.localeCompare(b.muscle));
}

export const peopleStarted = (n: number) => `${n} ${n === 1 ? 'person' : 'people'} started`;

export type SetupStep = { key: 'bio' | 'friends' | 'post' | 'photo'; title: string; body: string; action: string; done: boolean };

/** "Complete your profile" (board 15): four steps; null once all are done. */
export function completeProfileSteps(input: { bio: string | null; following: number; posts: number; hasPhoto: boolean }): { steps: SetupStep[]; done: number } | null {
  const steps: SetupStep[] = [
    { key: 'bio', title: 'Add a bio', body: "Tell people what you're working on", action: 'Add bio', done: !!input.bio?.trim() },
    { key: 'friends', title: 'Find friends', body: 'See who from your contacts is here', action: 'Find', done: input.following > 0 },
    { key: 'post', title: 'First post', body: 'Share a workout, meal or photo', action: 'Post', done: input.posts > 0 },
    { key: 'photo', title: 'Add a photo', body: "So your crew knows it's you", action: 'Add', done: input.hasPhoto },
  ];
  const done = steps.filter(s => s.done).length;
  return done === steps.length ? null : { steps, done };
}
