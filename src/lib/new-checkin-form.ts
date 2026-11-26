/** Pure rules for the new-version "New check-in" page and camera note. */
export type ComposeCrew = { id: string; name: string; inToday: boolean };

/** Crews ticked by default: the ones not checked in yet today. */
export function defaultCrewSelection(crews: ComposeCrew[]): string[] {
  return crews.filter((c) => !c.inToday).map((c) => c.id);
}

/** Keep a saved selection only for crews that still exist. */
export function restoreCrewSelection(saved: string[] | null | undefined, crews: ComposeCrew[]): string[] {
  if (!saved?.length) return defaultCrewSelection(crews);
  const ids = new Set(crews.map((c) => c.id));
  return saved.filter((id) => ids.has(id));
}

export function postButtonLabel(selected: string[], crews: ComposeCrew[], posting: boolean): string {
  if (posting) return "Posting...";
  if (selected.length > 1) return `Check in to ${selected.length} crews`;
  const one = crews.find((c) => c.id === selected[0]);
  return one ? `Check in to ${one.name}` : "Check in";
}

export function canPost(selected: string[], posting: boolean): boolean {
  return selected.length > 0 && !posting;
}

/** Note above the button: every selected crew is already in today. */
export function showAlreadyInNote(selected: string[], crews: ComposeCrew[]): boolean {
  if (!selected.length) return false;
  return selected.every((id) => crews.find((c) => c.id === id)?.inToday === true);
}

/** Camera note: already in today in every crew. */
export function showCameraAlreadyIn(crews: ComposeCrew[]): boolean {
  return crews.length > 0 && crews.every((c) => c.inToday);
}

export function defaultTag(attached: { workout: boolean; planDay: boolean }): string | null {
  return attached.workout || attached.planDay ? "workout" : null;
}

export function showTagCard(hasHealthWorkout: boolean): boolean {
  return !hasHealthWorkout;
}

/** Followers choice sent to the server; under-18 accounts always stay crew-only. */
export function followersChoice(requested: boolean | undefined, under18: boolean): boolean {
  return !under18 && requested === true;
}

export function clipLength(seconds: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
