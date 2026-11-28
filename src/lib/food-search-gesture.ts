/** Scroll events also fire for layout changes; only trusted input gestures dismiss search. */
export function shouldDismissFoodKeyboard(trusted: boolean, keyboardInset: number, distance: number) {
  return trusted && keyboardInset > 0 && Math.abs(distance) > 5;
}