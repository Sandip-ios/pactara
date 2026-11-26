import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

/**
 * Library rows the database tests rely on. A fresh draft has none of them,
 * so tests add only the missing ones before running and remove exactly those
 * afterwards. The cover photos are read from the migration that ships them.
 */
type Admin = <T>(path: string, method?: string, body?: unknown) => Promise<T>;

export const LIBRARY_EXERCISES = [
  { id: "barbell-row", name: "Bent-Over Barbell Row", primary_muscles: ["back"], muscles_detail: ["upper back", "lats"], equipment: "barbell" },
  { id: "bench-press", name: "Bench Press", primary_muscles: ["chest"], muscles_detail: ["chest"], equipment: "barbell" },
  { id: "kettlebell-swing", name: "Kettlebell Swing", primary_muscles: ["glutes", "hamstrings"], muscles_detail: ["glutes", "hamstrings"], equipment: "kettlebell" },
  { id: "banded-squat", name: "Banded Squat", primary_muscles: ["glutes", "quads"], muscles_detail: ["glutes", "quads"], equipment: "band" },
].map((e) => ({ ...e, source: "repdb", category: "strength", log_type: "reps" }));

export function coverPhotosFromMigration() {
  const sql = readFileSync(resolve(__dirname, "../../../drizzle/migrations/0088_workout_cover_library.sql"), "utf8");
  const re = /\('([^']+)','([^']+)',(\d+),ARRAY\[([^\]]*)\]::text\[\],'([^']+)','([^']+)','([^']+)','([^']+)'\)/g;
  return [...sql.matchAll(re)].map((m) => ({
    key: m[1]!, focus: m[2]!, slot: Number(m[3]), equipment: m[4]!.split(",").map((s) => s.trim().replace(/^'|'$/g, "")),
    url: m[5]!, credit: m[6]!, source: m[7]!, source_url: m[8]!,
  }));
}

const STATE = resolve(tmpdir(), "pactara-db-fixtures.json");
const LOCK = `${STATE}.lock`;
type State = { users: number; exercises: string[]; covers: string[] };

async function locked<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i += 1) {
    try { mkdirSync(LOCK); break; } catch { if (i > 600) throw new Error("fixture lock timeout"); await new Promise((r) => setTimeout(r, 50)); }
  }
  try { return await fn(); } finally { rmSync(LOCK, { recursive: true, force: true }); }
}
const read = (): State => (existsSync(STATE) ? (JSON.parse(readFileSync(STATE, "utf8")) as State) : { users: 0, exercises: [], covers: [] });

/**
 * Adds whatever library rows are missing; the returned function removes only
 * those, once the last test file using them (they can run in parallel) is done.
 */
export async function ensureLibraryFixtures(admin: Admin): Promise<() => Promise<void>> {
  await locked(async () => {
    const st = read();
    if (st.users === 0) {
      const have = await admin<{ id: string }[]>(`/rest/v1/exercises?select=id&id=in.(${LIBRARY_EXERCISES.map((e) => e.id).join(",")})`);
      const missing = LIBRARY_EXERCISES.filter((e) => !have.some((h) => h.id === e.id));
      if (missing.length) await admin("/rest/v1/exercises", "POST", missing);
      const covers = await admin<{ key: string }[]>("/rest/v1/workout_cover_photos?select=key");
      const addCovers = covers.length === 0 ? coverPhotosFromMigration() : [];
      if (addCovers.length) await admin("/rest/v1/workout_cover_photos", "POST", addCovers);
      st.exercises = missing.map((e) => e.id);
      st.covers = addCovers.map((c) => c.key);
    }
    st.users += 1;
    writeFileSync(STATE, JSON.stringify(st));
  });
  return () => locked(async () => {
    const st = read();
    st.users = Math.max(0, st.users - 1);
    if (st.users === 0) {
      if (st.covers.length) await admin(`/rest/v1/workout_cover_photos?key=in.(${st.covers.join(",")})`, "DELETE");
      if (st.exercises.length) await admin(`/rest/v1/exercises?id=in.(${st.exercises.join(",")})`, "DELETE");
      rmSync(STATE, { force: true });
    } else writeFileSync(STATE, JSON.stringify(st));
  });
}
