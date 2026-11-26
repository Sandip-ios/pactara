/**
 * Discover › Workouts (new version): pure rules for who is listed, the card
 * text, muscle/equipment/time filters, search, sorting, the "Most saved this
 * week" grid fallback and paging. No React, no data access.
 */
import { estimateMinutes } from "@/lib/workout-builder";
import { equipmentFromExercises } from "@/lib/new-workout-builder";
import { itemsFromSnapshot, type SnapshotItem, type TemplateItem } from "@/lib/workout-share";

export const DISCOVER_PAGE_SIZE = 20;

export const MUSCLE_CHIPS = [
  { key: "all", label: "All" },
  { key: "back", label: "Back" },
  { key: "chest", label: "Chest" },
  { key: "glutes", label: "Glutes" },
  { key: "legs", label: "Legs" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "core", label: "Core" },
] as const;
export type MuscleKey = (typeof MUSCLE_CHIPS)[number]["key"];

const MUSCLE_OF: Record<Exclude<MuscleKey, "all">, readonly string[]> = {
  back: ["back", "lats", "traps", "lower_back", "lower back"],
  chest: ["chest"],
  glutes: ["glutes"],
  legs: ["quads", "hamstrings", "calves", "legs", "adductors", "abductors"],
  shoulders: ["shoulders"],
  arms: ["biceps", "triceps", "forearms"],
  core: ["abs", "core", "obliques"],
};

export const EQUIPMENT_OPTIONS = [
  { key: "gym", label: "Gym" },
  { key: "dumbbells", label: "Dumbbells" },
  { key: "home", label: "Home" },
] as const;
export type EquipmentKey = (typeof EQUIPMENT_OPTIONS)[number]["key"];

export const TIME_OPTIONS = [
  { key: "u20", label: "Under 20 min" },
  { key: "20-40", label: "20-40 min" },
  { key: "40plus", label: "40+ min" },
] as const;
export type TimeKey = (typeof TIME_OPTIONS)[number]["key"];

export const SORT_OPTIONS = [
  { key: "saved", label: "Most saved" },
  { key: "newest", label: "Newest" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export type DiscoverQuery = { muscle: MuscleKey; equipment: EquipmentKey | null; time: TimeKey | null; sort: SortKey; q: string };

const pick = <T extends string>(v: unknown, keys: readonly { key: T }[]): T | null => (keys.find((k) => k.key === v)?.key ?? null);
export const parseMuscle = (v: unknown): MuscleKey => pick(v, MUSCLE_CHIPS) ?? "all";
export const parseEquipment = (v: unknown): EquipmentKey | null => pick(v, EQUIPMENT_OPTIONS);
export const parseTime = (v: unknown): TimeKey | null => pick(v, TIME_OPTIONS);
export const parseSort = (v: unknown): SortKey => pick(v, SORT_OPTIONS) ?? "saved";

/** Viewer-side copy of the database rule (discover_author_visible). Pactara is always listed. */
export type AuthorFacts = { id: string; pactara: boolean; newVersion: boolean; isPrivate: boolean; birthday: string | null; blockedEitherWay: boolean };
export function isUnder18(birthday: string | null, today: Date): boolean {
  if (!birthday) return false;
  const b = new Date(`${birthday.slice(0, 10)}T00:00:00Z`);
  const cut = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
  return b.getTime() > cut.getTime();
}
export function authorListed(a: AuthorFacts, viewerId: string, today: Date): boolean {
  if (a.pactara) return true;
  return a.id !== viewerId && a.newVersion && !a.isPrivate && !isUnder18(a.birthday, today) && !a.blockedEitherWay;
}

/** One row of the discover_workout_feed RPC. */
export type FeedRow = {
  code: string;
  name: string;
  exercises: SnapshotItem[];
  equipment: string | null;
  cover_url: string | null;
  pactara: boolean;
  owner_name: string | null;
  created_at: string;
  saves: number;
  saves_week: number;
  did_it: number;
  my_copy_id: string | null;
  my_copy_name: string | null;
  my_copy_exercises: TemplateItem[] | null;
};

export type ExerciseFacts = { name: string; primary: string[]; equipment: string; imageStart: string | null; imageBg: string | null };

export type DiscoverCard = {
  code: string;
  name: string;
  pactara: boolean;
  author: string;
  coverUrl: string | null;
  /** No cover: the first exercise drawing on its light blue. */
  drawing: { src: string; bg: string } | null;
  exercises: number;
  minutes: number;
  equipment: EquipmentKey;
  muscles: MuscleKey[];
  exerciseNames: string[];
  saves: number;
  savesWeek: number;
  didIt: number;
  createdAt: string;
  myCopyId: string | null;
  myCopyEdited: boolean;
};

const EQUIP_LABEL: Record<EquipmentKey, string> = { gym: "Gym", dumbbells: "Dumbbells", home: "Home" };

/** "1.2k", "980", "12k". */
export function compactCount(n: number): string {
  if (n < 1000) return String(Math.max(0, Math.round(n)));
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`.replace(".0k", "k");
}
export const savesLabel = (n: number) => `${compactCount(n)} ${n === 1 ? "save" : "saves"}`;

/** "6 exercises · 45 min · Gym" */
export const cardMeta = (c: Pick<DiscoverCard, "exercises" | "minutes" | "equipment">) =>
  `${c.exercises} ${c.exercises === 1 ? "exercise" : "exercises"} · ${c.minutes} min · ${EQUIP_LABEL[c.equipment]}`;

/** "by Maya Lindqvist · 1.2k saves"; "· 0 saves" is left off. */
export const cardByline = (c: Pick<DiscoverCard, "author" | "saves">) => ({ author: c.author, saves: c.saves > 0 ? ` · ${savesLabel(c.saves)}` : "" });

/** Did I change my saved copy? Name (ignoring the " 2" the copy gets on a clash) or any exercise field. */
export function copyEdited(sourceName: string, snapshot: readonly SnapshotItem[], copyName: string | null, copyItems: readonly TemplateItem[] | null): boolean {
  if (copyName == null || copyItems == null) return false;
  if (copyName.trim().replace(/\s+\d+$/, "") !== sourceName.trim().replace(/\s+\d+$/, "")) return true;
  const norm = (i: TemplateItem) => JSON.stringify([i.exerciseId, i.sets, i.reps ?? null, i.seconds ?? null, i.tip ?? null]);
  const a = itemsFromSnapshot(snapshot).map(norm);
  const b = copyItems.map(norm);
  return a.length !== b.length || a.some((x, i) => x !== b[i]);
}

export function musclesOf(primaries: readonly string[]): MuscleKey[] {
  const set = new Set(primaries.map((p) => p.trim().toLowerCase()));
  return (Object.keys(MUSCLE_OF) as Exclude<MuscleKey, "all">[]).filter((k) => MUSCLE_OF[k].some((m) => set.has(m)));
}

export function toCard(row: FeedRow, ex: ReadonlyMap<string, ExerciseFacts>): DiscoverCard {
  const items = row.exercises.filter((i) => ex.has(i.exerciseId));
  const facts = items.map((i) => ex.get(i.exerciseId)!);
  const sets = items.reduce((a, i) => a + Math.max(0, i.sets), 0);
  const equipment: EquipmentKey =
    row.equipment === "gym" || row.equipment === "dumbbells" || row.equipment === "home" ? row.equipment : equipmentFromExercises(facts.map((f) => f.equipment)) ?? "home";
  const first = facts.find((f) => f.imageStart);
  return {
    code: row.code,
    name: row.name,
    pactara: row.pactara,
    author: row.pactara ? "Pactara" : (row.owner_name ?? "").trim().replace(/\s+/g, " ") || "a member",
    coverUrl: row.cover_url,
    drawing: first ? { src: first.imageStart!, bg: first.imageBg ?? "#D8F1FD" } : null,
    exercises: items.length,
    minutes: estimateMinutes(sets),
    equipment,
    muscles: musclesOf(facts.flatMap((f) => f.primary)),
    exerciseNames: facts.map((f) => f.name),
    saves: row.saves,
    savesWeek: row.saves_week,
    didIt: row.did_it,
    createdAt: row.created_at,
    myCopyId: row.my_copy_id,
    myCopyEdited: copyEdited(row.name, row.exercises, row.my_copy_name, row.my_copy_exercises),
  };
}

export function timeFits(minutes: number, t: TimeKey): boolean {
  if (t === "u20") return minutes < 20;
  if (t === "20-40") return minutes >= 20 && minutes <= 40;
  return minutes > 40;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();

export function filterCards(cards: readonly DiscoverCard[], q: DiscoverQuery): DiscoverCard[] {
  const words = norm(q.q).split(/\s+/).filter(Boolean);
  const out = cards.filter(
    (c) =>
      c.exercises > 0 &&
      (q.muscle === "all" || c.muscles.includes(q.muscle)) &&
      (!q.equipment || c.equipment === q.equipment) &&
      (!q.time || timeFits(c.minutes, q.time)) &&
      (!words.length || words.every((w) => norm(c.name).includes(w) || c.exerciseNames.some((n) => norm(n).includes(w)))),
  );
  return sortCards(out, q.sort);
}

export function sortCards(cards: readonly DiscoverCard[], sort: SortKey): DiscoverCard[] {
  const newest = (a: DiscoverCard, b: DiscoverCard) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
  return [...cards].sort(sort === "newest" ? newest : (a, b) => b.saves - a.saves || b.didIt - a.didIt || newest(a, b));
}

/** "Most saved this week": this week's saves, topped up by all-time saves, then Pactara picks. Never empty when anything is listed. */
export function mostSavedThisWeek(cards: readonly DiscoverCard[], n = 4): DiscoverCard[] {
  const usable = cards.filter((c) => c.exercises > 0);
  const out: DiscoverCard[] = [];
  const add = (list: DiscoverCard[]) => {
    for (const c of list) if (out.length < n && !out.some((o) => o.code === c.code)) out.push(c);
  };
  add(usable.filter((c) => c.savesWeek > 0).sort((a, b) => b.savesWeek - a.savesWeek || b.saves - a.saves));
  add(usable.filter((c) => c.saves > 0).sort((a, b) => b.saves - a.saves));
  add(usable.filter((c) => c.pactara));
  add(usable);
  return out;
}

export function pageOf<T>(list: readonly T[], offset: number, size = DISCOVER_PAGE_SIZE): { items: T[]; nextOffset: number | null } {
  const items = list.slice(offset, offset + size);
  return { items, nextOffset: offset + size < list.length ? offset + size : null };
}

/** "48 back workouts", "1 workout", "12 workouts". */
export function countLine(n: number, muscle: MuscleKey): string {
  const label = muscle === "all" ? "" : `${MUSCLE_CHIPS.find((m) => m.key === muscle)!.label.toLowerCase()} `;
  return `${n} ${label}${n === 1 ? "workout" : "workouts"}`;
}
