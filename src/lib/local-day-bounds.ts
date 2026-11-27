/** Pure: the UTC instants where a member's local day starts and the next one
 *  starts, in their IANA timezone (same day boundaries streaks use). */
export function zonedWallTimeToISO(timezone: string, localDate: string, hour: number, minute: number = 0): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
    return new Date(guess - (asUTC - guess)).toISOString();
  } catch {
    return new Date(guess).toISOString();
  }
}

export function localDayBounds(timezone: string, localDate: string): { start: string; end: string } {
  const [y, m, d] = localDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
  return { start: zonedWallTimeToISO(timezone, localDate, 0), end: zonedWallTimeToISO(timezone, next, 0) };
}
