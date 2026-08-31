/**
 * Server helpers for deferred deep linking.
 *
 * When someone taps an invite link in mobile Safari and doesn't have the app,
 * we record a short-lived fingerprint (hashed IP + platform) alongside the
 * group id. On the app's very first launch it asks the server whether an
 * invite was recorded for the same network/platform recently, so the user
 * lands on the join screen without re-opening the link.
 */

const WINDOW_MINUTES = 180;

export function clientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
    ""
  );
}

export function platformFromUserAgent(ua: string): "ios" | "android" | "other" {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export async function fingerprint(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`pactara-deferred:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Carrier NAT hands out different addresses to Safari and to the freshly
 * installed app, so an exact IP match is too strict. Hashing the network
 * prefix (IPv4 /24, IPv6 /48) still matches the same network without
 * storing the raw address.
 */
export function ipPrefix(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":");
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : ip;
}

export function windowStartIso(minutes: number = WINDOW_MINUTES): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}


export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
