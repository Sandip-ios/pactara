import { Capacitor } from '@capacitor/core';
import { normalizeHealthWorkout, type HealthWorkout } from './health-workouts';

export function isAppleHealthPlatform() { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'; }
async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  if (!isAppleHealthPlatform() || !Capacitor.isPluginAvailable('Health')) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([run(), new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), 15000); })]); }
  catch { return fallback; } finally { if (timer) clearTimeout(timer); }
}
export const appleHealthAvailable = () => safe(async () => (await (await import('@capgo/capacitor-health')).Health.isAvailable()).available, false);
export const connectAppleHealth = () => safe(async () => {
  const { Health } = await import('@capgo/capacitor-health');
  const status = await Health.requestAuthorization({ read: ['workouts'], write: [] });
  return status.readAuthorized.includes('workouts') && !status.readDenied.includes('workouts');
}, false);
export const readAppleHealthToday = () => safe(async (): Promise<{ ok: boolean; workouts: HealthWorkout[] }> => {
  const { Health } = await import('@capgo/capacitor-health');
  const status = await Health.checkAuthorization({ read: ['workouts'], write: [] });
  if (!status.readAuthorized.includes('workouts')) return { ok: false, workouts: [] };
  const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0);
  const workouts: HealthWorkout[] = []; let anchor: string | undefined;
  do {
    const page = await Health.queryWorkouts({ startDate: start.toISOString(), endDate: now.toISOString(), limit: 100, ascending: false, ...(anchor ? { anchor } : {}) });
    for (const raw of page.workouts) { const w = normalizeHealthWorkout(raw); if (w) workouts.push(w); }
    if (!page.anchor || page.anchor === anchor) break;
    anchor = page.anchor;
  } while (workouts.length < 1000);
  return { ok: true, workouts };
}, { ok: false, workouts: [] });
export async function openAppleHealth() {
  if (!isAppleHealthPlatform()) return false;
  try { window.location.assign('x-apple-health://'); return true; } catch { return false; }
}

/** Account-scoped, short-lived handoff to the normal video flow. Never uploads on sync. */
let pending: { userId: string; workout: HealthWorkout; at: number } | null = null;
export function attachHealthWorkout(userId: string, workout: HealthWorkout) { pending = { userId, workout, at: Date.now() }; }
export function pendingHealthWorkout(userId: string) { return pending?.userId === userId && Date.now() - pending.at < 3600000 ? pending.workout : null; }
export function clearHealthWorkout() { pending = null; }