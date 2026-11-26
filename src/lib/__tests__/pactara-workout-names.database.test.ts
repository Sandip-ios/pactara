import { describe, expect, it } from "vitest";
import { PACTARA_WORKOUT_NAMES } from "../pactara-workout-names";

const base = "http://127.0.0.1:8001";
const key = () => {
  const value = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("Draft auth credentials unavailable");
  return value;
};

async function databaseName(pactaraKey: string, fallback: string): Promise<string> {
  const response = await fetch(`${base}/rest/v1/rpc/pactara_workout_name`, {
    method: "POST",
    headers: { apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ _key: pactaraKey, _fallback: fallback }),
  });
  if (!response.ok) throw new Error(`Draft request failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<string>;
}

describe.skipIf(!process.env["PGHOST"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])("Pactara Discover database names", () => {
  it("uses the same approved mapping that refresh_pactara_workouts calls", async () => {
    for (const [pactaraKey, name] of Object.entries(PACTARA_WORKOUT_NAMES)) {
      expect(await databaseName(pactaraKey, "Plan day title")).toBe(name);
      expect(name).not.toMatch(/ [ABC]$/);
    }
    expect(await databaseName("not-a-listed-key", "Plan day title")).toBe("Plan day title");
  });
});
