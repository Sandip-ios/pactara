/**
 * Pure streak / rest-day rules shared by the hourly job, the profile screens,
 * the Groups tab and Home. Everything here works on local calendar dates
 * ("YYYY-MM-DD") in the member's own timezone.
 *
 * - A week runs Monday → Sunday in the member's timezone.
 * - Rest days per week per group = 7 − days_per_week, except daily groups
 *   (frequency "daily" or 7 days a week), which keep 2 rest days a week.
 * - When a day closes with no check-in, a rest day is used automatically if
 *   one is left this week; otherwise the day is missed.
 * - Weekly target = 7 − rest days (daily groups: 5).
 * - Extra workouts beyond the weekly target never bank rest days.
 */

export const DAILY_GROUP_REST_DAYS = 2;

/** Local calendar date for an instant in an IANA timezone. */
export function localDateIn(timezone: string, when: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(when);
  } catch {
    return when.toISOString().slice(0, 10);
  }
}

export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Monday of the week containing this local date. */
export function weekStartIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  return addDaysIso(iso, -sinceMonday);
}

/** Sunday of the week containing this local date. */
export function weekEndIso(iso: string): string {
  return addDaysIso(weekStartIso(iso), 6);
}

/** Today's date and its Mon–Sun week in the member's timezone. */
export function localWeek(timezone: string, now: Date = new Date()) {
  const today = localDateIn(timezone, now);
  return { today, weekStart: weekStartIso(today), weekEnd: weekEndIso(today) };
}

export type GroupSchedule = { frequency?: string | null; days_per_week?: number | null };

function isDailyGroup(g: GroupSchedule): boolean {
  const dpw = g.days_per_week ?? 7;
  return (g.frequency ?? "daily") === "daily" || dpw >= 7;
}

function scheduledDays(g: GroupSchedule): number {
  return Math.max(1, Math.min(7, g.days_per_week ?? 7));
}

/** Rest days a member gets per Mon–Sun week in this group. */
export function restAllowance(g: GroupSchedule): number {
  if (isDailyGroup(g)) return DAILY_GROUP_REST_DAYS;
  return 7 - scheduledDays(g);
}

/**
 * Workouts a member owes this group per week = the days left after rest days,
 * so the target and the rest allowance always add up to 7 (daily groups: 5).
 */
export function weeklyTarget(g: GroupSchedule): number {
  return 7 - restAllowance(g);
}

export type ClosedDayOutcome = "kept" | "rest" | "missed";

/**
 * What happens when a member's day closes for one group.
 * `protectedDay` = a rest or streak-freeze row already covers the day.
 */
export function closeDay(input: {
  checkedIn: boolean;
  protectedDay: boolean;
  restUsedThisWeek: number;
  allowance: number;
}): ClosedDayOutcome {
  if (input.checkedIn || input.protectedDay) return "kept";
  if (input.restUsedThisWeek < input.allowance) return "rest";
  return "missed";
}

/** Consecutive kept days ending today (or yesterday, while today is still open). */
export function currentStreak(kept: Set<string>, today: string): number {
  let cursor = kept.has(today) ? today : addDaysIso(today, -1);
  let streak = 0;
  while (kept.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

export function bestStreak(kept: Iterable<string>): number {
  const sorted = [...new Set(kept)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const s of sorted) {
    run = prev && addDaysIso(prev, 1) === s ? run + 1 : 1;
    if (run > best) best = run;
    prev = s;
  }
  return best;
}

/** Last `n` local days ending today, oldest first, with kept flags. */
export function pastDays(kept: Set<string>, today: string, n: number) {
  const out: { date: string; checked: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDaysIso(today, -i);
    out.push({ date, checked: kept.has(date) });
  }
  return out;
}

/** Distinct check-in days in this Mon–Sun week and the one before. */
export function weekCounts(checkInDates: Iterable<string>, today: string) {
  const thisStart = weekStartIso(today);
  const lastStart = addDaysIso(thisStart, -7);
  let thisWeek = 0;
  let lastWeek = 0;
  for (const d of new Set(checkInDates)) {
    if (d >= thisStart && d <= today) thisWeek += 1;
    else if (d >= lastStart && d < thisStart) lastWeek += 1;
  }
  return { thisWeek, lastWeek };
}

/**
 * Group streak: consecutive days where every member who had joined by that
 * day either checked in or had a rest/freeze row. Each member's `kept` set and
 * `joinedOn` are in that member's own timezone.
 */
export function groupStreak(
  members: { joinedOn: string; kept: Set<string> }[],
  today: string,
  maxDays = 365,
): number {
  const everyone = (iso: string) => {
    const required = members.filter((m) => m.joinedOn <= iso);
    return required.length > 0 && required.every((m) => m.kept.has(iso));
  };
  let cursor = everyone(today) ? today : addDaysIso(today, -1);
  let streak = 0;
  while (streak < maxDays && everyone(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

/**
 * True when today would really be missed for this group: no check-in, no
 * rest/freeze row covering today, and no rest days left this week.
 */
export function dayAtRisk(input: {
  checkedInToday: boolean;
  protectedToday: boolean;
  restUsedThisWeek: number;
  allowance: number;
}): boolean {
  return (
    closeDay({
      checkedIn: input.checkedInToday,
      protectedDay: input.protectedToday,
      restUsedThisWeek: input.restUsedThisWeek,
      allowance: input.allowance,
    }) === "missed"
  );
}

/**
 * "Weeks on goal": completed Mon–Sun weeks since joining where distinct
 * check-in days reached the weekly target. Rest and freeze days don't count
 * toward the target. A week only counts once it has fully ended, and the
 * joining week counts only when the member joined on its Monday.
 */
export function weeksOnGoal(
  checkInDates: Iterable<string>,
  joinedOn: string,
  today: string,
  target: number,
): { hit: number; completed: number } {
  const days = new Set(checkInDates);
  const currentWeekStart = weekStartIso(today);
  let start = weekStartIso(joinedOn);
  if (start < joinedOn) start = addDaysIso(start, 7);
  let hit = 0;
  let completed = 0;
  for (let ws = start; ws < currentWeekStart; ws = addDaysIso(ws, 7)) {
    completed += 1;
    let n = 0;
    for (let i = 0; i < 7; i++) if (days.has(addDaysIso(ws, i))) n += 1;
    if (n >= target) hit += 1;
  }
  return { hit, completed };
}

export type WeekDayState = "checked" | "rest" | "none";

/** Monday → Sunday states for the week starting `weekStart`. */
export function weekDayStates(
  weekStart: string,
  checkIns: Set<string>,
  restOrFreeze: Set<string>,
): { date: string; state: WeekDayState }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(weekStart, i);
    const state: WeekDayState = checkIns.has(date) ? "checked" : restOrFreeze.has(date) ? "rest" : "none";
    return { date, state };
  });
}
