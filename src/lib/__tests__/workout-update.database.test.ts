import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { mergeTemplate, type SavedItem } from "../workout-update";

const base = "http://127.0.0.1:8001";
const svc = () => process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
async function call<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: svc(), Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}
const users: string[] = [];

// Draft-only data; the temporary account and its workout are removed afterwards.
describe.skipIf(!process.env["PGHOST"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])("updating a saved workout after finishing", () => {
  afterAll(async () => {
    for (const id of users) {
      await call(`/rest/v1/workouts?user_id=eq.${id}`, svc(), "DELETE");
      await call(`/auth/v1/admin/users/${id}`, svc(), "DELETE");
    }
  });

  it("keeps reps and tip as the member's own write", async () => {
    const email = `${randomUUID()}@example.com`;
    const password = randomUUID();
    const user = await call<{ id: string }>("/auth/v1/admin/users", svc(), "POST", { email, password, email_confirm: true });
    users.push(user.id);
    const session = await call<{ access_token: string }>("/auth/v1/token?grant_type=password", svc(), "POST", { email, password });
    const token = session.access_token;
    const start: SavedItem[] = [{ exerciseId: "barbell-row", sets: 3, reps: "10", restSeconds: 120, tip: "Squeeze at the top" }];
    const [w] = await call<{ id: string }[]>("/rest/v1/workouts", token, "POST", { user_id: user.id, name: "Pull", exercises: start, equipment: "gym" });
    const [row] = await call<{ exercises: SavedItem[] }[]>(`/rest/v1/workouts?id=eq.${w!.id}&select=exercises`, token);
    const merged = mergeTemplate(row!.exercises, [{ exerciseId: "barbell-row", sets: 4, restSeconds: 120 }, { exerciseId: "face-pull", sets: 3, restSeconds: 90 }], () => "reps");
    await call(`/rest/v1/workouts?id=eq.${w!.id}`, token, "PATCH", { exercises: merged });
    const [after] = await call<{ exercises: SavedItem[]; equipment: string }[]>(`/rest/v1/workouts?id=eq.${w!.id}&select=exercises,equipment`, token);
    expect(after!.exercises[0]).toEqual({ exerciseId: "barbell-row", sets: 4, reps: "10", restSeconds: 120, tip: "Squeeze at the top" });
    expect(after!.exercises[1]).toMatchObject({ exerciseId: "face-pull", sets: 3, reps: "10" });
    expect(after!.equipment).toBe("gym");
  });
});
