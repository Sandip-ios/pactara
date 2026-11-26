/** End-of-pact rules (new version). Dates are local ISO days (YYYY-MM-DD). */
export const PACT_LENGTHS = [
  { days: 30, sub: "1 month" },
  { days: 60, sub: "2 months" },
  { days: 90, sub: "3 months" },
] as const;

const DAY = 86_400_000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Last day of a pact that starts on `start` and lasts `duration` days. */
export const pactLastDay = (start: string, duration: number) => addDays(start, Math.max(1, duration) - 1);

/** The pact is done once the viewer's today is after its last day. */
export const isPactDone = (today: string, start: string, duration: number) => today > pactLastDay(start, duration);

/** Days a member showed up within a pact (unique check-in days). */
export const daysShownUp = (dates: Iterable<string>, start: string, duration: number) => {
  const end = pactLastDay(start, duration);
  const seen = new Set<string>();
  for (const d of dates) if (d >= start && d <= end) seen.add(d);
  return seen.size;
};

/** Longest run of consecutive pact days on which every member who had joined by then checked in. */
export function longestCrewRun(members: { joinedOn: string; days: Set<string> }[], start: string, duration: number) {
  let best = 0, run = 0;
  for (let i = 0; i < duration; i++) {
    const d = addDays(start, i);
    const due = members.filter((m) => m.joinedOn <= d);
    if (due.length > 0 && due.every((m) => m.days.has(d))) best = Math.max(best, ++run);
    else run = 0;
  }
  return best;
}

export const pactDoneSubtitle = (longest: number, together: number) => {
  const total = `${together} check-in${together === 1 ? "" : "s"} together.`;
  return longest > 0 ? `Longest crew streak this pact: ${longest} day${longest === 1 ? "" : "s"}. ${total}` : total;
};

export const shareResultText = (shown: number, total: number, crew: string) => `I showed up ${shown} of ${total} days with ${crew} on Pactara`;

export const nextPactStartLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const newPactPush = (crew: string, days: number) => `${crew} started a new ${days}-day pact.`;

export const newPactBannerBody = (last: { shown: number; total: number } | null) =>
  `${last ? `Last pact you showed up ${last.shown} of ${last.total} days. ` : ""}Everyone is in for this one. Set a new goal for it.`;

/** "A, B and C get a notification…" from first names of the other members. */
export const notifyNamesLine = (names: string[]) => {
  const list = names.length <= 1 ? (names[0] ?? "Your crew") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} get${names.length === 1 ? "s" : ""} a notification. They stay in unless they leave.`;
};
