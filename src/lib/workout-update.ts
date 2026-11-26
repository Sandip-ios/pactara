/**
 * How finishing a workout updates a saved one (pure, testable).
 * The server merges so builder fields (reps, seconds, tip) survive; the new
 * version compares the logger's full list with the saved workout.
 */
export type SavedItem = { exerciseId: string; sets: number; restSeconds?: number; seconds?: number; reps?: string; tip?: string };
export type TemplateItem = { exerciseId: string; sets: number; restSeconds?: number; name?: string };

/** Builder defaults for an exercise the saved workout didn't have. */
export function defaultItemFields(logType: "reps" | "timed"): Pick<SavedItem, "reps" | "seconds"> {
  return logType === "timed" ? { seconds: 30 } : { reps: "10" };
}

/** New list order and set counts; saved reps/seconds/tip kept; rest only if the logger changed it. */
export function mergeTemplate(saved: SavedItem[], next: TemplateItem[], logTypeOf: (id: string) => "reps" | "timed"): SavedItem[] {
  const pool = new Map<string, SavedItem[]>();
  for (const s of saved) pool.set(s.exerciseId, [...(pool.get(s.exerciseId) ?? []), s]);
  return next.map((n) => {
    const prev = pool.get(n.exerciseId)?.shift();
    if (!prev) {
      const out: SavedItem = { exerciseId: n.exerciseId, sets: n.sets, ...defaultItemFields(logTypeOf(n.exerciseId)) };
      if (n.restSeconds != null) out.restSeconds = n.restSeconds;
      return out;
    }
    const out: SavedItem = { ...prev, sets: n.sets };
    if (n.restSeconds != null && n.restSeconds !== prev.restSeconds && !(prev.restSeconds == null && n.restSeconds === 90)) out.restSeconds = n.restSeconds;
    return out;
  });
}

/** New version: every exercise still in the logger, set count = set rows. */
export function templateFromLogger(exercises: { exerciseId: string; name: string; sets: unknown[]; restSeconds: number; primary: string[] }[]) {
  return exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: e.sets.length, restSeconds: e.restSeconds, primary: e.primary }));
}

export function hasStructuralChange(saved: SavedItem[], next: TemplateItem[]): boolean {
  if (saved.length !== next.length) return true;
  return saved.some((s, i) => s.exerciseId !== next[i]!.exerciseId || s.sets !== next[i]!.sets);
}

/** "hidden" when nothing structural changed; otherwise shown, off by default. */
export function updateRowState(saved: SavedItem[] | null, next: TemplateItem[]): { show: boolean; defaultOn: boolean } {
  if (!saved) return { show: true, defaultOn: false };
  return { show: hasStructuralChange(saved, next), defaultOn: false };
}

const MAX_PHRASES = 3;

/** "Adds Face pull, removes Plank, 4 sets of Barbell row instead of 3." */
export function changesLine(saved: SavedItem[], next: TemplateItem[], nameOf: (id: string) => string): string {
  const savedIds = saved.map((s) => s.exerciseId);
  const nextIds = next.map((n) => n.exerciseId);
  const phrases: string[] = [];
  for (const n of next) if (!savedIds.includes(n.exerciseId)) phrases.push(`adds ${n.name ?? nameOf(n.exerciseId)}`);
  for (const s of saved) if (!nextIds.includes(s.exerciseId)) phrases.push(`removes ${nameOf(s.exerciseId)}`);
  for (const n of next) {
    const s = saved.find((x) => x.exerciseId === n.exerciseId);
    if (s && s.sets !== n.sets) phrases.push(`${n.sets} ${n.sets === 1 ? "set" : "sets"} of ${n.name ?? nameOf(n.exerciseId)} instead of ${s.sets}`);
  }
  const common = (ids: string[], other: string[]) => ids.filter((id) => other.includes(id));
  if (common(savedIds, nextIds).join("|") !== common(nextIds, savedIds).join("|")) phrases.push("new exercise order");
  if (!phrases.length) return "";
  const shown = phrases.slice(0, MAX_PHRASES);
  const rest = phrases.length - shown.length;
  let line = shown.join(", ");
  if (rest > 0) line += `, and ${rest} more ${rest === 1 ? "change" : "changes"}`;
  return line.charAt(0).toUpperCase() + line.slice(1) + ".";
}

type DoneInput = {
  workoutId: string | null;
  title: string;
  plan: unknown;
  template: { exerciseId: string; sets: number; restSeconds: number }[];
  fullTemplate?: (TemplateItem & { restSeconds: number })[];
};
export type DoneSaveRow = {
  show: boolean;
  defaultOn: boolean;
  title: string;
  subtitle: string;
  template: { exerciseId: string; sets: number; restSeconds: number }[];
};

/**
 * The done screen's Save / Update row. Classic: unchanged (default on unless a
 * plan day, checked-sets template). New: an update only appears when the
 * structure changed, off by default; `saved` null = still loading (hidden).
 */
export function doneSaveRow(version: "classic" | "new", fw: DoneInput, saved: SavedItem[] | null | undefined, nameOf: (id: string) => string): DoneSaveRow {
  const isNew = !fw.workoutId;
  const classicTitle = isNew ? "Save as a workout" : `Update “${fw.title}”`;
  const base = { title: classicTitle, subtitle: "Next time starts with today's weights.", template: fw.template };
  if (version === "classic" || isNew) return { ...base, show: fw.template.length > 0, defaultOn: !fw.plan };
  const full = fw.fullTemplate ?? fw.template;
  if (!saved || !full.length) return { ...base, template: full, show: false, defaultOn: false };
  const state = updateRowState(saved, full);
  return { title: classicTitle, subtitle: changesLine(saved, full, nameOf), template: full, ...state };
}
