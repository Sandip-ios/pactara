/**
 * Finds "Squat 4x8", "4x8 squats", "Bench 4 sets of 8", "Rows: 3 x 10 @ 60kg"
 * in a caption. Only sets and reps are kept; weights are dropped on purpose.
 */
export type CaptionMove = { query: string; sets: number; reps: number };

const WEIGHT = /(@|at)?\s*\d+(?:[.,]\d+)?\s*(kg|kgs|lb|lbs|pounds?)\b/gi;

export function parseCaptionMoves(caption: string): CaptionMove[] {
  const out: CaptionMove[] = [];
  for (const raw of caption.split(/\n|[,;•]|\s-\s/)) {
    const line = raw.replace(WEIGHT, " ").replace(/[:()]/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const m =
      line.match(/^(.*?)\s*(\d{1,2})\s*(?:x|×|\*)\s*(\d{1,3})\b(.*)$/i) ??
      line.match(/^(.*?)\s*(\d{1,2})\s*sets?\s*(?:of|x|×)?\s*(\d{1,3})\s*(?:reps?)?\b(.*)$/i);
    if (!m) continue;
    const name = cleanName(m[1] || m[4] || "");
    const sets = Number(m[2]);
    const reps = Number(m[3]);
    if (!name || sets < 1 || sets > 20 || reps < 1 || reps > 200) continue;
    out.push({ query: name, sets, reps });
  }
  return out;
}

function cleanName(s: string): string {
  return s.replace(/[^a-zA-Z' -]/g, " ").replace(/\b(sets?|reps?|of|did|then|and)\b/gi, " ").replace(/\s+/g, " ").trim();
}

/** "We found 2 exercises". */
export function foundLabel(n: number): string {
  return `We found ${n} ${n === 1 ? "exercise" : "exercises"}`;
}

/** "4 sets · 8 reps". */
export function setsRepsLine(sets: number, reps: number | null): string {
  const head = `${sets} ${sets === 1 ? "set" : "sets"}`;
  return reps ? `${head} · ${reps} reps` : head;
}

/** Best library match: exact, then singular/plural, then the shortest name containing the query. */
export function bestExerciseMatch<T extends { name: string }>(query: string, candidates: T[]): T | null {
  const q = norm(query);
  if (!q) return null;
  const exact = candidates.find((c) => norm(c.name) === q || norm(c.name) === q.replace(/s$/, ""));
  if (exact) return exact;
  const words = q.replace(/s\b/g, "").split(" ").filter((w) => w.length > 2);
  const scored = candidates
    .filter((c) => words.every((w) => norm(c.name).includes(w)))
    .sort((a, b) => a.name.length - b.name.length);
  return scored[0] ?? null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
