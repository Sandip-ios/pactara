/**
 * Where a cold launch lands. Pure: the facts are gathered while the launch
 * screen is up (see launch-start.ts) and this picks the first screen, so the
 * member goes straight there with no flash of Home first.
 *
 * Priority:
 *  1. an invite link (existing behaviour, signed in or not)
 *  2. signed out → /login in the app (the web keeps its landing page),
 *     except a shared-workout link (/w/…), which works signed out
 *  3. a notification tap or deep link (including /w/…) → that screen
 *  4. signup left part-way → resume it
 *  5. unfinished goal → /goal, unsigned pact → /pact, match waiting for you → /partner
 *  6. otherwise Home
 */
export type LaunchFacts = {
  native: boolean;
  signedIn: boolean;
  inviteGroupId: string | null;
  linkPath: string | null;
  signupResume: { onPartner: boolean; groupId: string | null } | null;
  goalGroupId: string | null;
  pactGroupId: string | null;
  partnerPending: boolean;
};

export type LaunchDestination =
  | { to: "join"; groupId: string }
  | { to: "login" }
  | { to: "landing" }
  | { to: "link"; href: string }
  | { to: "signup-partner"; groupId: string | null }
  | { to: "signup" }
  | { to: "goal"; groupId: string }
  | { to: "pact"; groupId: string }
  | { to: "partner" }
  | { to: "home" };

/** Links that open the same page signed in or out (a shared workout). */
export function isPublicLinkPath(path: string | null | undefined): boolean {
  return !!path && /^\/w\/[A-Za-z0-9]{8}\/?(\?|#|$)/.test(path);
}

export function decideLaunch(f: LaunchFacts): LaunchDestination {
  if (f.inviteGroupId) return { to: "join", groupId: f.inviteGroupId };
  if (!f.signedIn) {
    if (isPublicLinkPath(f.linkPath)) return { to: "link", href: f.linkPath! };
    return f.native ? { to: "login" } : { to: "landing" };
  }
  if (f.linkPath) return { to: "link", href: f.linkPath };
  if (f.signupResume) return f.signupResume.onPartner ? { to: "signup-partner", groupId: f.signupResume.groupId } : { to: "signup" };
  if (f.goalGroupId) return { to: "goal", groupId: f.goalGroupId };
  if (f.pactGroupId) return { to: "pact", groupId: f.pactGroupId };
  if (f.partnerPending) return { to: "partner" };
  return { to: "home" };
}

const APP_HOSTS = new Set(["pactara.lovable.app", "pactara.app", "www.pactara.app", "localhost", "localhost:8080"]);

/**
 * In-app path for a notification URL or deep link: "/home?post=…" stays as is,
 * "https://pactara.lovable.app/plans/x" → "/plans/x", "pactara://chat/abc" →
 * "/chat/abc". Other sites, and the bare root (nothing to open), give null.
 */
export function toAppPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  let path: string;
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    path = raw;
  } else {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (!APP_HOSTS.has(url.host)) return null;
      path = `${url.pathname}${url.search}${url.hash}`;
    } else if (url.protocol === "pactara:") {
      path = `/${url.host}${url.pathname}${url.search}${url.hash}`.replace(/^\/+/, "/");
    } else {
      return null;
    }
  }
  if (path === "/" || path === "" || /^\/(\?|#|$)/.test(path)) return null;
  return path;
}
