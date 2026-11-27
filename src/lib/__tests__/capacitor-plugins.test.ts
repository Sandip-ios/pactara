import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../../", import.meta.url);
const configSource = readFileSync(new URL("capacitor.config.ts", ROOT), "utf8");
const pkg = JSON.parse(
  readFileSync(new URL("package.json", ROOT), "utf8"),
) as { dependencies?: Record<string, string> };

// Capacitor only copies native code for plugins listed in `includePlugins`.
// A plugin missing from that list is skipped by `npx cap sync ios` and then
// fails silently on device, so every native plugin dependency must be listed.
const PLUGIN_SCOPES = [
  "@capacitor/",
  "@capacitor-community/",
  "@capacitor-firebase/",
  "@capawesome/",
  "@capgo/",
  "@revenuecat/",
];

// Tooling and runtime packages that are not native plugins.
const NOT_NATIVE_PLUGINS = new Set([
  "@capacitor/android",
  "@capacitor/cli",
  "@capacitor/core",
  "@capacitor/ios",
]);

// Plugins deliberately left out of `includePlugins`, with the reason.
const EXCLUDED = new Map<string, string>([
  [
    "@capawesome/capacitor-badge",
    "Imported by src/lib/badge-client.ts but never listed in includePlugins; the owner has not decided whether to add it, because that would make `npx cap sync ios` report 11 plugins.",
  ],
]);

function includePluginsFrom(source: string): Set<string> {
  const start = source.indexOf("includePlugins: [");
  expect(start, "capacitor.config.ts must define includePlugins").toBeGreaterThan(
    -1,
  );
  const block = source.slice(start, source.indexOf("]", start));
  return new Set(
    [...block.matchAll(/"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((name): name is string => typeof name === "string"),
  );
}

const listed = includePluginsFrom(configSource);
const nativePlugins = Object.keys(pkg.dependencies ?? {}).filter(
  (name) =>
    PLUGIN_SCOPES.some((scope) => name.startsWith(scope)) &&
    !NOT_NATIVE_PLUGINS.has(name),
);

describe("Capacitor includePlugins", () => {
  it("lists every native plugin dependency", () => {
    const missing = nativePlugins.filter(
      (name) => !listed.has(name) && !EXCLUDED.has(name),
    );
    expect(
      missing,
      `Add these to includePlugins in capacitor.config.ts: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("includes the Apple Health plugin so cap sync installs it", () => {
    expect(listed.has("@capgo/capacitor-health")).toBe(true);
  });

  it("matches the plugin count the iPhone README promises", () => {
    expect(listed.size).toBe(11);
  });
});
