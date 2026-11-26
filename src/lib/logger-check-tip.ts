/** First-run "Tap when complete" tip on the new logger's set checkbox. Pure rules. */
type Ex = { key: string; sets: readonly { id: string; done: boolean }[] };

/** The first unchecked set in the first exercise card that has one. */
export function checkTipTarget(exercises: readonly Ex[]): { exKey: string; setId: string } | null {
  for (const e of exercises) {
    const s = e.sets.find((x) => !x.done);
    if (s) return { exKey: e.key, setId: s.id };
  }
  return null;
}

/** Once per account: only while the saved flag is loaded and empty, never during rest. */
export function shouldShowCheckTip(input: {
  loaded: boolean;
  seenAt: string | null;
  dismissed: boolean;
  restRunning: boolean;
  exercises: readonly Ex[];
}): boolean {
  if (!input.loaded || input.seenAt || input.dismissed || input.restRunning) return false;
  return checkTipTarget(input.exercises) !== null;
}
