import { describe, expect, it } from 'vitest';
import { buildFeedDays } from '../feed-days';
import { notificationTarget } from '../notifications.functions';
import { activityOpenUrl, crewPostUrl } from '../activity-deeplink';
import {
  attachedCard, checkInCardMeta, checkInTag, hasWeightedExercise, healthCardLine, healthSourceNote,
  healthTiles, sheetSetLine, showCheckedInPill, showPrChip,
} from '../redesign-feed-view';
import type { FeedItem } from '../daily-posts.functions';

const ci = (id: string, at: string) => ({ kind: 'check_in' as const, id: `c-${id}`, mood: null, activity: null, note: null, photoUrl: null, at });
const item = (nodes: FeedItem['nodes']): FeedItem => ({
  id: 'post-1', groupId: 'g', userId: 'u', isMe: false, name: 'Maya Lee', avatarColor: '#000', avatarUrl: null,
  localDate: '2026-11-27', updatedAt: '', nodes, reactions: [], reactors: [], commentCount: 0, lastCommentAt: null,
  latestComment: null, dayNumber: 1, weekCount: 1,
});
const name = (t: string) => (t === 'running' ? 'Run' : 'Workout');

describe('one card per check-in (new version)', () => {
  const posts = [item([ci('a', '2026-11-27T06:12:00Z'), ci('b', '2026-11-27T18:00:00Z')])];
  it('splits a member’s two check-ins into two cards, newest first', () => {
    const day = buildFeedDays(posts, null, '2026-11-27', { split: true })[0]!;
    expect(day.entries.map((e) => e.key)).toEqual(['ci-c-b', 'ci-c-a']);
  });
  it('classic keeps one grouped card', () => {
    const day = buildFeedDays(posts, null, '2026-11-27')[0]!;
    expect(day.entries).toHaveLength(1);
  });
});

describe('card wording', () => {
  it('meta line: time today, Yesterday for yesterday, tag left out when none', () => {
    expect(checkInCardMeta({ time: '6:12 am', localDate: '2026-11-27', viewerToday: '2026-11-27', tag: 'Workout' })).toBe('6:12 am · Workout');
    expect(checkInCardMeta({ time: '6:12 am', localDate: '2026-11-26', viewerToday: '2026-11-27', tag: 'Run' })).toBe('Yesterday · Run');
    expect(checkInCardMeta({ time: '6:12 am', localDate: '2026-11-27', viewerToday: '2026-11-27', tag: null })).toBe('6:12 am');
  });
  it('every check-in gets the Checked in pill; posts do not', () => {
    expect(showCheckedInPill('check_in')).toBe(true);
    expect(showCheckedInPill('post')).toBe(false);
  });
  it('tags a logged workout as Workout and a Health run by its name', () => {
    expect(checkInTag({ workout: { title: 'Push', exercises: 1, sets: 1, minutes: 1, prCount: 0 } }, name, () => null)).toBe('Workout');
    expect(checkInTag({ health: { type: 'running', duration: 1, distance: null, calories: null } }, name, () => null)).toBe('Run');
  });
  it('workout card: label, name, line and a PR flag, never a weight', () => {
    const c = attachedCard({ workout: { title: 'Upper', exercises: 5, sets: 15, minutes: 42, prCount: 1 } }, 'mi', name)!;
    expect(c).toEqual({ kind: 'workout', label: 'WORKOUT', title: 'Upper', line: '5 exercises · 15 sets · 42 min', pr: true });
  });
  it('plan card: PLAN · WEEK w, DAY d and "Plan: Day"', () => {
    const c = attachedCard({ plan: { name: 'Build Muscle', slug: 'build-muscle', week: 2, day: 1, dayName: 'Push' }, workout: { title: null, exercises: 4, sets: 12, minutes: 40, prCount: 0 } }, 'mi', name)!;
    expect([c.label, c.title, c.line]).toEqual(['PLAN · WEEK 2, DAY 1', 'Build Muscle: Push', '4 exercises · 12 sets · 40 min']);
  });
  it('Health line: distance, time and pace for runs; minutes and calories otherwise', () => {
    expect(healthCardLine({ type: 'running', duration: 1720, distance: 4988.97, calories: 300 }, 'mi')).toBe('3.1 mi · 28:40 · 9:15 /mi');
    expect(healthCardLine({ type: 'yoga', duration: 2700, distance: null, calories: 312 }, 'mi')).toBe('45 min · 312 cal');
  });
  it('Health tiles show only stats that exist', () => {
    expect(healthTiles({ type: 'yoga', duration: 2700, distance: null, calories: null }, 'mi').map((t) => t.label)).toEqual(['Time']);
    expect(healthTiles({ type: 'running', duration: 1720, distance: 4988.97, calories: 300 }, 'mi').map((t) => t.label)).toEqual(['Distance', 'Time', 'Pace', 'Calories']);
  });
  it('Health note names the crewmate or you', () => {
    expect(healthSourceNote('Maya', false)).toBe("From Apple Health on Maya's iPhone.");
    expect(healthSourceNote('Maya', true)).toBe('From Apple Health on your iPhone.');
  });
});

describe('sheet rules', () => {
  it('set lines show reps or times, never weights', () => {
    expect(sheetSetLine([{ reps: 10, seconds: null, weight: 135 }, { reps: 8, seconds: null, weight: 135 }, { reps: 8, seconds: null, weight: 135 }], 'reps')).toBe('3 sets · 10, 8, 8 reps');
    expect(sheetSetLine([{ reps: null, seconds: 45 }, { reps: null, seconds: 45 }, { reps: null, seconds: 30 }], 'timed')).toBe('3 sets · 0:45, 0:45, 0:30');
  });
  it('PR chips: always on check-ins, only your own on posts', () => {
    expect(showPrChip('check_in', false)).toBe(true);
    expect(showPrChip('post', false)).toBe(false);
    expect(showPrChip('post', true)).toBe(true);
  });
  it('weights note only when a weighted exercise exists', () => {
    expect(hasWeightedExercise([{ sets: [{ reps: 10, seconds: null, weight: 0 }] }])).toBe(false);
    expect(hasWeightedExercise([{ sets: [{ reps: 10, seconds: null, weight: 50 }] }])).toBe(true);
  });
});

describe('notifications for a later check-in (new version)', () => {
  const scopedPhoto = new Map([['ci-2', 'u/second.mp4']]);
  it('uses that check-in’s photo and id', () => {
    expect(notificationTarget({ perCheckIn: true, checkInId: 'ci-2', firstCheckInId: 'ci-1', scopedPhoto, postPhoto: 'u/first.mp4' }))
      .toEqual({ checkInId: 'ci-2', mediaPath: 'u/second.mp4' });
  });
  it('falls back to the day’s first check-in when the row has none', () => {
    expect(notificationTarget({ perCheckIn: true, checkInId: null, firstCheckInId: 'ci-1', scopedPhoto, postPhoto: 'u/first.mp4' }))
      .toEqual({ checkInId: 'ci-1', mediaPath: 'u/first.mp4' });
  });
  it('classic keeps the first check-in photo and no check-in id', () => {
    expect(notificationTarget({ perCheckIn: false, checkInId: 'ci-2', firstCheckInId: 'ci-1', scopedPhoto, postPhoto: 'u/first.mp4' }))
      .toEqual({ checkInId: null, mediaPath: 'u/first.mp4' });
  });
  it('links carry the check-in so the feed lands on that card', () => {
    expect(activityOpenUrl({ kind: 'reaction', postId: 'p', checkInId: 'ci-2' })).toBe('/activity/open?kind=reaction&post=p&checkin=ci-2');
    expect(crewPostUrl({ groupId: 'g', postId: 'p', checkInId: 'ci-2' })).toBe('/crews/g?crewTab=posts&post=p&checkin=ci-2');
  });
});
