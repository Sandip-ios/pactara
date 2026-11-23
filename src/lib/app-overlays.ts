/**
 * Full-screen overlays owned by the app layout (intro / trial-ended paywall).
 * Home reads this before opening a one-time sheet so it never lands on top of
 * them. `pending` = the layout hasn't finished deciding yet.
 */
type LayoutOverlayState = { pending: boolean; blocking: boolean };

let state: LayoutOverlayState = { pending: true, blocking: false };

export function setLayoutOverlayState(next: LayoutOverlayState) {
  state = next;
}

export function getLayoutOverlayState(): LayoutOverlayState {
  return state;
}

/** Any sheet, dialog or menu currently on screen. */
export function anyOverlayOnScreen(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector("[data-vaul-drawer], [role='dialog'], [role='alertdialog'], [role='menu']");
}
