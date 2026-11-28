/** Keep the white sheet full-height; reserve occluded space inside it for the keyboard.
 * visualViewport can end above the native accessory bar, so it must not be the surface edge.
 */
export function foodSearchViewport(height: number, visible?: { height: number; offsetTop: number }) {
  return {
    height,
    inset: visible ? Math.min(height, Math.max(0, height - visible.height - visible.offsetTop)) : 0,
  };
}