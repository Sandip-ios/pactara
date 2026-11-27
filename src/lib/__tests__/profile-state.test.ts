import { describe, expect, it } from 'vitest';
import { groupByMuscle, memberInfoParts, ownInfoLine, profileState, sharedCrewLabel, statLabel, workoutMeta, type ProfileStateInput } from '../profile-state';

const other = (o: Partial<Extract<ProfileStateInput, { status: 'other' }>> = {}): ProfileStateInput => ({ status: 'other', iBlocked: false, isPrivate: false, under18: false, follow: 'none', followsMe: false, canFollow: true, sharedCrews: 0, nudgeable: false, ...o });

describe('profileState', () => {
  it('own profile: menu, edit + share, tabs', () => {
    expect(profileState({ status: 'own' })).toMatchObject({ header: { left: 'none', right: 'menu' }, buttons: ['edit', 'share'], content: 'tabs' });
  });
  it('not following: Follow + Share profile', () => {
    expect(profileState(other())).toMatchObject({ header: { left: 'back', right: 'more' }, buttons: ['follow', 'share'], content: 'tabs' });
  });
  it('following', () => expect(profileState(other({ follow: 'following' })).buttons).toEqual(['following', 'share']));
  it('they follow you: Follow back and "Follows you"', () => {
    expect(profileState(other({ followsMe: true }))).toMatchObject({ buttons: ['follow_back', 'share'], followsYou: true });
  });
  it('private, requested: Requested + lock card', () => {
    expect(profileState(other({ isPrivate: true, follow: 'requested' }))).toMatchObject({ buttons: ['requested'], content: 'locked' });
  });
  it('private, not following: Follow + lock card', () => {
    expect(profileState(other({ isPrivate: true }))).toMatchObject({ buttons: ['follow'], content: 'locked', crewLink: false });
  });
  it('private and followed: tabs', () => expect(profileState(other({ isPrivate: true, follow: 'following' })).content).toBe('tabs'));
  it('under 18 behaves as private', () => expect(profileState(other({ under18: true })).content).toBe('locked'));
  it('crewmate: Nudge only when nudgeable', () => {
    expect(profileState(other({ sharedCrews: 1, nudgeable: true })).buttons).toEqual(['follow', 'nudge']);
    expect(profileState(other({ sharedCrews: 1, nudgeable: false })).buttons).toEqual(['follow', 'share']);
    expect(profileState(other({ sharedCrews: 0, nudgeable: true })).buttons).toEqual(['follow', 'share']);
  });
  it('private crewmate: lock card with crew row', () => {
    expect(profileState(other({ isPrivate: true, sharedCrews: 1, nudgeable: true }))).toMatchObject({ buttons: ['follow', 'nudge'], content: 'locked', crewLink: true });
  });
  it('you blocked them: only Unblock, no tabs', () => {
    expect(profileState(other({ iBlocked: true, follow: 'following', sharedCrews: 2 }))).toMatchObject({ buttons: ['unblock'], content: 'blocked' });
  });
  it('deleted or blocked you: back only, unavailable card', () => {
    expect(profileState({ status: 'unavailable' })).toMatchObject({ header: { left: 'back', right: 'none' }, buttons: [], content: 'unavailable', showInfo: false });
  });
  it('loading and error', () => {
    expect(profileState({ status: 'loading' }).content).toBe('skeleton');
    expect(profileState({ status: 'error' }).content).toBe('error');
  });
  it('classic member (cannot follow): Share only', () => expect(profileState(other({ canFollow: false })).buttons).toEqual(['share']));
});

describe('info lines', () => {
  it('crew label', () => {
    expect(sharedCrewLabel(['FitFam'])).toBe('In FitFam with you');
    expect(sharedCrewLabel(['FitFam', 'Runners'])).toBe('In FitFam +1 with you');
    expect(sharedCrewLabel([])).toBeNull();
  });
  it('member parts', () => {
    expect(memberInfoParts({ crewNames: ['FitFam'], streak: 46, followsYou: false, followedBy: null })).toEqual([{ icon: 'users', text: 'In FitFam with you' }, { icon: 'flame', text: '46-day streak' }]);
    expect(memberInfoParts({ crewNames: [], streak: 0, followsYou: true, followedBy: 'Followed by Ana' })).toEqual([{ icon: null, text: 'Followed by Ana' }, { icon: null, text: 'Follows you' }]);
  });
  it('own line', () => {
    expect(ownInfoLine(18, 4)).toEqual([{ icon: 'flame', text: '18-day streak' }, { icon: null, text: '4 badges' }]);
    expect(ownInfoLine(0, 1)).toEqual([{ icon: null, text: '1 badge' }]);
  });
  it('stat labels are singular at 1', () => {
    expect(statLabel('posts', 1)).toBe('post');
    expect(statLabel('followers', 1)).toBe('follower');
    expect(statLabel('posts', 0)).toBe('posts');
    expect(statLabel('followers', 2)).toBe('followers');
    expect(statLabel('following', 1)).toBe('following');
  });
  it('workout meta', () => {
    expect(workoutMeta({ exercises: 6, minutes: 45, fromName: 'Maya Lindqvist', saves: 3 }, true)).toBe('6 exercises · 45 min · from Maya Lindqvist · saved 3 times');
    expect(workoutMeta({ exercises: 1, minutes: 5, fromName: null, saves: 0 }, true)).toBe('1 exercise · 5 min');
    expect(workoutMeta({ exercises: 4, minutes: 30, fromName: 'X', saves: 1 }, false)).toBe('4 exercises · 30 min · 1 save');
  });
  it('groups by muscle', () => {
    const g = groupByMuscle([{ muscle: 'Legs', name: 'a' }, { muscle: 'Back', name: 'b' }, { muscle: 'Back', name: 'c' }]);
    expect(g.map(x => [x.muscle, x.items.length])).toEqual([['Back', 2], ['Legs', 1]]);
  });
});

import { completeProfileSteps } from '../profile-state';
describe('completeProfileSteps', () => {
  it('counts done steps', () => {
    const r = completeProfileSteps({ bio: null, following: 0, posts: 0, hasPhoto: true });
    expect(r?.done).toBe(1);
    expect(r?.steps.map(s => s.done)).toEqual([false, false, false, true]);
  });
  it('blank bio is not done', () => expect(completeProfileSteps({ bio: '  ', following: 1, posts: 1, hasPhoto: true })?.done).toBe(3));
  it('disappears when all 4 are done', () => expect(completeProfileSteps({ bio: 'Hi', following: 2, posts: 1, hasPhoto: true })).toBeNull());
});
