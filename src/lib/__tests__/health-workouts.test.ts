import { describe, expect, it } from 'vitest';
import { healthDistanceUnit, healthStats, unusedHealthWorkouts, normalizeHealthWorkout, healthWorkoutSchema, healthPromptEligible, healthVideoRequired, type HealthWorkout } from '@/lib/health-workouts';

const workout: HealthWorkout = { uuid: '11111111-1111-4111-8111-111111111111', source: 'Apple Watch', type: 'outdoorRunning', start: '2026-11-24T06:42:00Z', duration: 1920, distance: 6598.3104, calories: 310 };
describe('Health workout rules', () => {
  it('does not offer a used Health UUID again', () => {
    expect(unusedHealthWorkouts([workout], [workout.uuid], new Date('2026-11-24T12:00:00Z'))).toEqual([]);
  });
  it('offers only today, deduplicated and latest first', () => {
    const latest = { ...workout, uuid: '22222222-2222-4222-8222-222222222222', start: '2026-11-24T10:00:00Z' };
    expect(unusedHealthWorkouts([workout, workout, latest, { ...workout, start: '2026-11-23T06:42:00Z' }], [], new Date('2026-11-24T12:00:00Z')).map(w => w.uuid)).toEqual([latest.uuid, workout.uuid]);
  });
  it('uses the phone local day, including midnight', () => {
    const now = new Date(2026, 10, 24, 0, 10);
    const midnight = { ...workout, start: new Date(2026, 10, 24, 0, 1).toISOString() };
    const yesterday = { ...workout, start: new Date(2026, 10, 23, 23, 59).toISOString() };
    expect(unusedHealthWorkouts([midnight, yesterday], [], now)).toEqual([midnight]);
  });
  it('formats posted duration, US miles and calories', () => { expect(healthStats(workout, 'en-US')).toBe('32 min · 4.1 mi · 310 cal'); });
  it('formats non-US distance in kilometres', () => { expect(healthStats({ ...workout, distance: 4100 }, 'en-GB')).toBe('32 min · 4.1 km · 310 cal'); });
  it('chooses miles for US, kilometres for other regions', () => { expect(healthDistanceUnit('es-US')).toBe('mi'); expect(healthDistanceUnit('en-CA')).toBe('km'); });
  it('omits unavailable stats but retains known zero values', () => { expect(healthStats({ ...workout, distance: null, calories: null })).toBe('32 min'); expect(healthStats({ ...workout, distance: 0, calories: 0 })).toBe('32 min · 0.0 mi · 0 cal'); });
  it('requires video, never a photo or no media', () => { expect(healthVideoRequired('crew/member.mp4')).toBe(true); expect(healthVideoRequired('crew/member.jpg')).toBe(false); expect(healthVideoRequired(null)).toBe(false); });
  it('only prompts after a first successful check-in', () => { expect(healthPromptEligible(true, false, false, true)).toBe(true); expect(healthPromptEligible(false, false, false, true)).toBe(false); });
  it('never prompts after dismissal, when connected or on other platforms', () => { expect(healthPromptEligible(true, true, false, true)).toBe(false); expect(healthPromptEligible(true, false, true, true)).toBe(false); expect(healthPromptEligible(true, false, false, false)).toBe(false); });
  it('posts only the seven approved fields', () => { expect(Object.keys(healthWorkoutSchema.parse({ ...workout, heartRate: 150, route: [1, 2] })).sort()).toEqual(['calories', 'distance', 'duration', 'source', 'start', 'type', 'uuid']); });
  it('maps workouts without unrelated sample permissions or data', () => {
    expect(normalizeHealthWorkout({ workoutType: 'running', duration: 1920, startDate: workout.start, endDate: '2026-11-24T07:14:00Z', platformId: workout.uuid, sourceName: 'Apple Watch', totalDistance: 6598.3104, totalEnergyBurned: 310, metadata: { HKIndoorWorkout: '0', private: 'do not store' } })).toEqual(workout);
  });
  it('rejects records with no stable UUID or invalid measurements', () => {
    expect(normalizeHealthWorkout({ workoutType: 'running', duration: 10, startDate: workout.start, endDate: workout.start })).toBeNull();
    expect(healthWorkoutSchema.safeParse({ ...workout, calories: -1 }).success).toBe(false);
  });
});