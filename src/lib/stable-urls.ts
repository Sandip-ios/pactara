/**
 * Every feed refetch re-signs storage URLs, producing a new token each time.
 * A new URL means the browser treats the same photo/video as a new file and
 * downloads it again (and restarts the video). This keeps the first signed URL
 * per file for most of its one-hour lifetime so refetches hit the cache.
 */
const REUSE_MS = 45 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();

function stableUrl(url: string): string {
  if (!url.includes("/storage/v1/") || !url.includes("token=")) return url;
  const q = url.indexOf("?");
  const params = new URLSearchParams(url.slice(q + 1));
  params.delete("token");
  const key = url.slice(0, q) + "?" + params.toString();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < REUSE_MS) return hit.url;
  cache.set(key, { url, at: now });
  return url;
}

export function stabilizeSignedUrls<T>(value: T): T {
  if (typeof value === "string") return stableUrl(value) as T;
  if (Array.isArray(value)) return value.map((v) => stabilizeSignedUrls(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stabilizeSignedUrls(v);
    }
    return out as T;
  }
  return value;
}
