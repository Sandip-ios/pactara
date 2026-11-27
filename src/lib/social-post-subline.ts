import type { AudienceKind } from "./post-audience";

/** Where a post went, shown before the time: "FitFam", "FitFam +1", "Only me", or nothing. */
export function postPlaceLabel(audience: AudienceKind, viewerCrews: { name: string }[]): string | null {
  if (audience === "only_me") return "Only me";
  const first = viewerCrews[0];
  if (!first) return null;
  return viewerCrews.length > 1 ? `${first.name} +${viewerCrews.length - 1}` : first.name;
}

export function postSubline(audience: AudienceKind, viewerCrews: { name: string }[], time: string): string {
  const place = postPlaceLabel(audience, viewerCrews);
  return place ? `${place} · ${time}` : time;
}
