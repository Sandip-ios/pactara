import { currentStreak, localDateIn } from './streak-rules';

export type FollowActivity = {
  timezone: string | null;
  crews: { id: string; dates: string[]; freezes: string[] }[];
  badge_count: number;
};

// A member can have several crews. Never combine dates from different crews
// into an artificial streak; use their longest current crew streak.
export function followProfileStats(activity: FollowActivity, now = new Date()) {
  const today = localDateIn(activity.timezone || 'UTC', now);
  return {
    current_streak: Math.max(0, ...activity.crews.map(crew => currentStreak(new Set([...crew.dates, ...crew.freezes]), today))),
    badge_count: activity.badge_count,
  };
}

export type FollowNotificationKind = 'follow' | 'follow_request' | 'follow_accepted';
export function followNotificationText(name: string, kind: FollowNotificationKind) {
  const first = name.trim().split(/\s+/)[0] || 'Someone';
  return `${first} ${kind === 'follow' ? 'started following you' : kind === 'follow_request' ? 'asked to follow you' : 'accepted your follow request'}`;
}