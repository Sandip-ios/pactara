import { describe, expect, it } from 'vitest';
import { foodSearchViewport } from '../food-search-viewport';

describe('Add food sheet keyboard sizing', () => {
  it('keeps the surface at the full 844px height and reserves the 364px keyboard inset internally', () => {
    const size = foodSearchViewport(844, { height: 480, offsetTop: 0 });
    expect(size).toEqual({ height: 844, inset: 364 });
    // Surface reaches behind an accessory bar starting 28px below the viewport edge.
    expect(size.height).toBeGreaterThanOrEqual(508);
    expect(size.height - size.inset).toBe(480);
  });
  it('accounts for a panned visual viewport without moving the surface up', () => {
    expect(foodSearchViewport(844, { height: 480, offsetTop: 28 })).toEqual({ height: 844, inset: 336 });
  });
  it('restores the current full sheet height with no keyboard space when the keyboard closes', () => {
    expect(foodSearchViewport(844, { height: 844, offsetTop: 0 })).toEqual({ height: 844, inset: 0 });
  });
  it('handles a native-resized webview without subtracting the keyboard twice', () => {
    expect(foodSearchViewport(508, { height: 480, offsetTop: 0 })).toEqual({ height: 508, inset: 28 });
  });
  it('uses the full window when visualViewport is unavailable', () => {
    expect(foodSearchViewport(844)).toEqual({ height: 844, inset: 0 });
  });
  it('clamps negative and oversized occlusion to the window bounds', () => {
    expect(foodSearchViewport(844, { height: 860, offsetTop: 0 }).inset).toBe(0);
    expect(foodSearchViewport(844, { height: 0, offsetTop: -20 }).inset).toBe(844);
  });
});