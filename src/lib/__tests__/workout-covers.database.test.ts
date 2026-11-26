import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const base = "http://127.0.0.1:8001";
type Account = { id: string };
type Workout = { id: string; cover_key: string | null };
type Cover = { key: string; focus: string; slot: number; equipment: string[]; url: string; credit: string; source: string; source_url: string };

const key = () => {
  const value = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("Draft auth credentials unavailable");
  return value;
};
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = (await response.json()) as { message?: string; msg?: string };
    throw new Error(error.message ?? error.msg ?? `Draft request failed: ${response.status}`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
const admin = <T,>(path: string, method = "GET", body?: unknown) => request<T>(path, method, body);
const accounts = { current: [] as Account[] };
const exercises = { current: [] as string[] };
const move = (exerciseId: string) => ({ exerciseId, sets: 3, reps: "10" });

async function saveWorkout(userId: string, name: string, items: ReturnType<typeof move>[], equipment = "home"): Promise<Workout> {
  const rows = await admin<Workout[]>("/rest/v1/workouts", "POST", { user_id: userId, name, exercises: items, equipment });
  if (!rows[0]) throw new Error("Workout was not created");
  return rows[0];
}
async function customExercise(userId: string, primary: string[], detail: string[], equipment = "bodyweight"): Promise<string> {
  const rows = await admin<{ id: string }[]>("/rest/v1/exercises", "POST", {
    owner_id: userId,
    source: "custom",
    name: `Cover test ${randomUUID()}`,
    primary_muscles: primary,
    muscles_detail: detail,
    equipment,
    category: "strength",
    log_type: "reps",
  });
  const id = rows[0]?.id;
  if (!id) throw new Error("Exercise was not created");
  exercises.current.push(id);
  return id;
}

// Uses only this draft's local Data API. Every account, workout and custom
// exercise is temporary and removed even when a check fails.
describe.skipIf(!process.env["PGHOST"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])("Workout cover database rules", () => {
  beforeAll(async () => {
    for (const version of ["new", "classic"] as const) {
      const user = await admin<Account>("/auth/v1/admin/users", "POST", { email: `${randomUUID()}@example.com`, password: randomUUID(), email_confirm: true });
      accounts.current.push(user);
      await admin(`/rest/v1/profiles?id=eq.${user.id}`, "PATCH", { app_version: version, new_version_enabled: version === "new", is_private: false, birthday: "1990-01-01" });
    }
  });
  afterEach(async () => {
    for (const account of accounts.current) await admin(`/rest/v1/workouts?user_id=eq.${account.id}`, "DELETE");
    for (const id of exercises.current) await admin(`/rest/v1/exercises?id=eq.${id}`, "DELETE");
    exercises.current = [];
  });
  afterAll(async () => {
    for (const account of accounts.current) {
      await admin(`/rest/v1/workouts?user_id=eq.${account.id}`, "DELETE");
      await admin(`/auth/v1/admin/users/${account.id}`, "DELETE");
    }
  });

  it("ships three credited, self-hosted photos for each of the eight focuses", async () => {
    const covers = await admin<Cover[]>("/rest/v1/workout_cover_photos?select=key,focus,slot,equipment,url,credit,source,source_url");
    expect(covers).toHaveLength(24);
    for (const focus of ["back", "chest", "shoulders", "arms", "legs", "glutes", "core", "full_body"]) {
      expect(covers.filter((c) => c.focus === focus).map((c) => c.slot).sort()).toEqual([1, 2, 3]);
    }
    for (const cover of covers) {
      expect(cover.url).toMatch(/^\/__l5e\/assets-v1\//);
      expect(["Unsplash", "Pexels"]).toContain(cover.source);
      expect(cover.credit.length).toBeGreaterThan(0);
      if (cover.source === "Unsplash") expect(cover.source_url).toMatch(/^https:\/\/images\.unsplash\.com\//);
      else expect(cover.source_url).toMatch(/^https:\/\/www\.pexels\.com\/photo\//);
    }
    for (const equipment of ["gym", "dumbbells", "home", "kettlebell", "bands"]) {
      expect(covers.some((c) => c.equipment.includes(equipment))).toBe(true);
    }
  });

  it("leaves a single-exercise workout without a cover key", async () => {
    const workout = await saveWorkout(accounts.current[0]!.id, "One move", [move("barbell-row")], "gym");
    expect(workout.cover_key).toBeNull();
  });

  it("leaves classic workouts without a cover key", async () => {
    const workout = await saveWorkout(accounts.current[1]!.id, "Classic", [move("barbell-row"), move("bench-press")], "gym");
    expect(workout.cover_key).toBeNull();
  });

  it("stores the same multi-exercise key when the same workout is saved again", async () => {
    const workout = await saveWorkout(accounts.current[0]!.id, "Back day", [move("barbell-row"), move("bench-press")], "gym");
    expect(workout.cover_key).toMatch(/^back-/);
    const renamed = await admin<Workout[]>(`/rest/v1/workouts?id=eq.${workout.id}&select=id,cover_key`, "PATCH", { name: "Back day renamed" });
    expect(renamed[0]?.cover_key).toBe(workout.cover_key);
    const resaved = await admin<Workout[]>(`/rest/v1/workouts?id=eq.${workout.id}&select=id,cover_key`, "PATCH", { exercises: [move("barbell-row"), move("bench-press")], equipment: "gym" });
    expect(resaved[0]?.cover_key).toBe(workout.cover_key);
  });

  it("uses the most common primary muscle and puts balanced three-focus workouts in full body", async () => {
    const chest = await saveWorkout(accounts.current[0]!.id, "Chest", [move("bench-press"), move("bench-press"), move("barbell-row")], "gym");
    expect(chest.cover_key).toMatch(/^chest-/);
    const back = await customExercise(accounts.current[0]!.id, ["back"], ["back"]);
    const full = await saveWorkout(accounts.current[0]!.id, "Full", [move("kettlebell-swing"), move("custom-push-up"), move(back)], "home");
    expect(full.cover_key).toBe("full_body-2");
  });

  it("uses detailed primary muscles before broad primary labels", async () => {
    const arm = await customExercise(accounts.current[0]!.id, ["back"], ["biceps"], "dumbbell");
    const workout = await saveWorkout(accounts.current[0]!.id, "Arms", [move(arm), move(arm), move("barbell-row")], "dumbbells");
    expect(workout.cover_key).toMatch(/^arms-/);
  });

  it("uses the home-compatible lunge photo for a home leg workout", async () => {
    const quads = await customExercise(accounts.current[0]!.id, ["quads"], ["quads"]);
    const workout = await saveWorkout(accounts.current[0]!.id, "Band legs", [move("banded-squat"), move(quads)], "home");
    expect(workout.cover_key).toBe("legs-2");
  });

  it("varies covers deterministically between neighbouring back workouts", async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const workout = await saveWorkout(accounts.current[0]!.id, `Back ${i}`, [move("barbell-row"), move("barbell-row")], "gym");
      if (workout.cover_key) keys.add(workout.cover_key);
    }
    expect(keys.size).toBeGreaterThan(1);
    expect([...keys].every((k) => /^back-[123]$/.test(k))).toBe(true);
  });
});
