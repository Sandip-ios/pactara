/** Pure wording for the redesign's crew Posts tab. */
import type { DayStat } from "@/lib/feed-view";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "TODAY", "YESTERDAY", then "MON, NOV 23". */
export function redesignDayLabel(date: string, viewerToday: string): string {
  if (date >= viewerToday) return "TODAY";
  if (date === shiftDate(viewerToday, -1)) return "YESTERDAY";
  const d = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** A past day kept the crew streak when someone was due, nobody missed and someone checked in. */
export function crewStreakKept(stat: DayStat | null | undefined): boolean {
  return !!stat && stat.due > 0 && stat.missed.length === 0 && stat.checkedIn.length > 0;
}

/** "Chris cheered", "Maya and you cheered", "Maya, Chris +2 cheered"; null with no cheers. */
export function cheeredByLine(reactors: { firstName: string; isMe: boolean }[]): string | null {
  if (reactors.length === 0) return null;
  const names = [...reactors.filter((r) => !r.isMe).map((r) => r.firstName), ...reactors.filter((r) => r.isMe).map(() => "you")];
  if (names.length === 1) return `${names[0] === "you" ? "You" : names[0]} cheered`;
  if (names.length === 2) return `${names[0]} and ${names[1]} cheered`;
  return `${names[0]}, ${names[1]} +${names.length - 2} cheered`;
}

/** "6:12 am · Back day", or just the time. */
export function postMetaLine(time: string, activity: string | null | undefined): string {
  return activity ? `${time} · ${activity}` : time;
}
