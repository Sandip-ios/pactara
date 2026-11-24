import { z } from "zod";
import type { Workout } from "@capgo/capacitor-health";

/** The only Health fields allowed to leave the phone, and only on a video post. */
export const healthWorkoutSchema = z.object({
  uuid: z.string().uuid(), source: z.string().min(1).max(100),
  type: z.string().min(1).max(80), start: z.string().datetime({ offset: true }),
  duration: z.number().finite().nonnegative().max(604800),
  distance: z.number().finite().nonnegative().max(10000000).nullable(),
  calories: z.number().finite().nonnegative().max(100000).nullable(),
}).strip();
export type HealthWorkout = z.infer<typeof healthWorkoutSchema>;
export function normalizeHealthWorkout(w: Workout): HealthWorkout | null {
  const outdoor = w.metadata?.['HKIndoorWorkout'] === '0';
  const result = healthWorkoutSchema.safeParse({
    uuid: w.platformId, source: w.sourceName || "Apple Health",
    type: outdoor && w.workoutType === 'running' ? 'outdoorRunning' : outdoor && w.workoutType === 'cycling' ? 'outdoorCycling' : w.workoutType,
    start: w.startDate, duration: w.duration,
    distance: w.totalDistance ?? null, calories: w.totalEnergyBurned ?? null,
  });
  return result.success ? result.data : null;
}
export function healthWorkoutName(type: string): string {
  const names: Record<string, string> = { running: "Run", outdoorRunning: "Outdoor run", runningTreadmill: "Indoor run", cycling: "Ride", outdoorCycling: "Outdoor ride", walking: "Walk", traditionalStrengthTraining: "Strength training", functionalStrengthTraining: "Functional training", highIntensityIntervalTraining: "HIIT", other: "Workout" };
  const words = type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return names[type] ?? words.charAt(0).toUpperCase() + words.slice(1);
}
export function healthWorkoutIcon(type: string): string {
  return /run|walk|hiking/i.test(type) ? '🏃' : /cycl|bik/i.test(type) ? '🚴' : /swim/i.test(type) ? '🏊' : /yoga|pilates|mind/i.test(type) ? '🧘' : '💪';
}
export function healthDistanceUnit(locale: string): 'mi' | 'km' {
  try { return new Intl.Locale(locale).maximize().region === 'US' ? 'mi' : 'km'; } catch { return 'km'; }
}
export function healthStats(w: HealthWorkout, locale = 'en-US', includeCalories = true): string {
  const unit = healthDistanceUnit(locale);
  const parts = [`${Math.round(w.duration / 60)} min`];
  if (w.distance !== null) parts.push(`${(w.distance / (unit === 'mi' ? 1609.344 : 1000)).toFixed(1)} ${unit}`);
  if (includeCalories && w.calories !== null) parts.push(`${Math.round(w.calories)} cal`);
  return parts.join(' · ');
}
export function healthClock(start: string, locale = 'en-US'): string {
  return new Date(start).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}
export function unusedHealthWorkouts(workouts: HealthWorkout[], used: string[], now: Date): HealthWorkout[] {
  const ids = new Set(used);
  const unique = new Map<string, HealthWorkout>();
  for (const w of workouts) {
    const date = new Date(w.start);
    if (date.toDateString() === now.toDateString() && date <= now && !ids.has(w.uuid)) unique.set(w.uuid, w);
  }
  return [...unique.values()].sort((a, b) => b.start.localeCompare(a.start));
}
export function healthVideoRequired(path: string | null): boolean { return !!path && /\.(mp4|mov|m4v|webm)$/i.test(path); }
export function healthPromptEligible(first: boolean, seen: boolean, connected: boolean, iosAvailable: boolean): boolean { return first && !seen && !connected && iosAvailable; }