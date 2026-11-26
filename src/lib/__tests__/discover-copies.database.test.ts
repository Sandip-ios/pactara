import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

const base = "http://127.0.0.1:8001";
const key = () => {
  const value = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("Draft auth credentials unavailable");
  return value;
};
async function admin<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Draft request failed: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
type Profile = { app_version: string; new_version_enabled: boolean; is_private: boolean; birthday: string | null };
const eligible: Profile = { app_version: "new", new_version_enabled: true, is_private: false, birthday: "1990-01-01" };
const users: string[] = [];
const move = (exerciseId: string) => ({ exerciseId, sets: 3, reps: "10" });

async function member(profile: Profile): Promise<string> {
  const user = await admin<{ id: string }>("/auth/v1/admin/users", "POST", { email: `${randomUUID()}@example.com`, password: randomUUID(), email_confirm: true });
  users.push(user.id);
  await admin(`/rest/v1/profiles?id=eq.${user.id}`, "PATCH", profile);
  return user.id;
}
async function workout(userId: string): Promise<string> {
  const rows = await admin<{ id: string }[]>("/rest/v1/workouts", "POST", { user_id: userId, name: "Copy rule", exercises: [move("barbell-row"), move("bench-press")], equipment: "gym" });
  return rows[0]!.id;
}
const copies = async (workoutId: string) =>
  (await admin<unknown[]>(`/rest/v1/shared_workouts?discover=eq.true&workout_id=eq.${workoutId}&select=code`)).length;

// Uses only this draft's local data; every account is temporary.
describe.skipIf(!process.env["PGHOST"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])("Discover copy owner rule", () => {
  afterAll(async () => {
    for (const id of users) {
      await admin(`/rest/v1/workouts?user_id=eq.${id}`, "DELETE");
      await admin(`/auth/v1/admin/users/${id}`, "DELETE");
    }
  });

  it("keeps a copy for a new-version, public, adult owner", async () => {
    expect(await copies(await workout(await member(eligible)))).toBe(1);
  });
  it("keeps no copy for a classic owner", async () => {
    expect(await copies(await workout(await member({ ...eligible, app_version: "classic", new_version_enabled: false })))).toBe(0);
  });
  it("keeps no copy for a private owner", async () => {
    expect(await copies(await workout(await member({ ...eligible, is_private: true })))).toBe(0);
  });
  it("keeps no copy for an under-18 owner", async () => {
    const birthday = `${new Date().getFullYear() - 16}-01-01`;
    expect(await copies(await workout(await member({ ...eligible, birthday, is_private: true })))).toBe(0);
  });
  it("removes copies when the owner goes private and restores them when public again", async () => {
    const id = await member(eligible);
    const w = await workout(id);
    expect(await copies(w)).toBe(1);
    await admin(`/rest/v1/profiles?id=eq.${id}`, "PATCH", { is_private: true });
    expect(await copies(w)).toBe(0);
    await admin(`/rest/v1/profiles?id=eq.${id}`, "PATCH", { is_private: false });
    expect(await copies(w)).toBe(1);
  });
  it("removes copies when the owner goes back to classic", async () => {
    const id = await member(eligible);
    const w = await workout(id);
    await admin(`/rest/v1/profiles?id=eq.${id}`, "PATCH", { app_version: "classic" });
    expect(await copies(w)).toBe(0);
  });
});
