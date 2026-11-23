/**
 * Plan sharing rules (pure, no React, no network): the link, the words on
 * the share sheet, chat card and link preview. Only public plan info and the
 * sharer's first name ever leave the app.
 */
import { SHARE_ORIGIN, isShareCode } from "@/lib/workout-share";

export { isShareCode as isPlanShareCode };

export const isPlanSlug = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

/** https://pactara.lovable.app/p/build-muscle?from=Ab3dEf7h (no "from" when the code is unknown). */
export function planShareUrl(slug: string, code?: string | null): string {
  const base = `${SHARE_ORIGIN}/p/${slug}`;
  return code && isShareCode(code) ? `${base}?from=${code}` : base;
}

export const planShareTitle = (name: string) => `${name} · Pactara`;
export const planShareText = (name: string) => `Try the ${name} plan with me on Pactara`;

type PlanSize = { weeks: number; daysPerWeek: number; minutes: string };

const weeksLabel = (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`;
const daysLabel = (n: number) => `${n} ${n === 1 ? "day" : "days"} a week`;
const minLabel = (m: string) => `${m.trim()} min`;

/** "8 weeks · 5 days a week · 40 min" */
export const planMetaLine = (p: PlanSize) => `${weeksLabel(p.weeks)} · ${daysLabel(p.daysPerWeek)} · ${minLabel(p.minutes)}`;

/** Link preview text: "8 weeks · 5 days a week · 40 min. Free on Pactara." */
export const planOgDescription = (p: PlanSize) => `${planMetaLine(p)}. Free on Pactara.`;

/**
 * The plan cover at a given size. Unsplash covers take sizing parameters
 * (crop to fill); anything else that is already an absolute https URL is
 * used as is; no cover (or a relative one) gives null.
 */
export function planCoverAt(url: string | null | undefined, w: number, h: number): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.hostname === "images.unsplash.com") {
    u.searchParams.set("w", String(w));
    u.searchParams.set("h", String(h));
    u.searchParams.set("fit", "crop");
    u.searchParams.set("auto", "format");
    if (!u.searchParams.has("q")) u.searchParams.set("q", "70");
  }
  return u.toString();
}

/** The link preview image: the cover cropped to 1200×630. */
export const planOgImage = (url: string | null | undefined) => planCoverAt(url, 1200, 630);

/** Above the chat card: "Ana shared a plan" / "You shared a plan". */
export const chatPlanShareLabel = (firstName: string, mine: boolean) => `${mine ? "You" : firstName} shared a plan`;

/** Push and notification text: "Ana shared a plan: Build Muscle". */
export const planSharePushText = (firstName: string, name: string) => `${firstName} shared a plan: ${name}`;

/** "Week 1 preview": the first three day names of week 1, in order. */
export function weekOnePreview(days: readonly { dayNumber: number; weekNumber: number | null; title: string }[], count = 3): string[] {
  return days
    .filter((d) => d.weekNumber == null || d.weekNumber === 1)
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .reduce<{ seen: Set<number>; out: string[] }>(
      (acc, d) => {
        if (!acc.seen.has(d.dayNumber)) {
          acc.seen.add(d.dayNumber);
          acc.out.push(d.title);
        }
        return acc;
      },
      { seen: new Set(), out: [] },
    )
    .out.slice(0, count);
}

/** Crews that already got this plan from you (kept as Sent; no resend). */
export function crewsSentPlan(messages: readonly { groupId: string; slug: string | null }[], slug: string): string[] {
  return [...new Set(messages.filter((m) => m.slug === slug).map((m) => m.groupId))];
}

/** The public /p/ page: plan info anyone may see, plus the sharer's first name when the link names them. */
export type PublicPlan = {
  slug: string;
  name: string;
  level: string;
  weeks: number;
  daysPerWeek: number;
  minutes: string;
  summary: string;
  coverUrl: string | null;
  weekOne: string[];
  sharerFirstName: string | null;
};

/** What a chat card shows for a shared plan. */
export type ChatPlanCard = {
  slug: string;
  name: string;
  level: string;
  weeks: number;
  daysPerWeek: number;
  minutes: string;
  coverUrl: string | null;
};
