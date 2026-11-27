/**
 * The one check-in that counts for a member's local day in a crew: the earliest
 * by created_at, ties broken by id. Mirrors SQL public.is_counted_check_in.
 * Later same-day check-ins are normal posts that count for nothing.
 */
export type CountableCheckIn = { id: string; created_at: string };

export function countedCheckInId(rows: readonly CountableCheckIn[]): string | null {
  let best: CountableCheckIn | null = null;
  for (const r of rows) {
    if (!best || r.created_at < best.created_at || (r.created_at === best.created_at && r.id < best.id)) best = r;
  }
  return best?.id ?? null;
}

/** Distinct local days from check-in dates (totals count days, not posts). */
export function distinctDays(dates: Iterable<string>): number {
  return new Set(dates).size;
}
