import { describe, expect, it } from 'vitest';
import { shouldDismissFoodKeyboard } from '../food-search-gesture';

describe('Add food keyboard dismissal', () => {
  it('dismisses on a real results drag or wheel gesture while the keyboard is open', () => {
    expect(shouldDismissFoodKeyboard(true, 336, 20)).toBe(true);
    expect(shouldDismissFoodKeyboard(true, 336, -20)).toBe(true);
  });
  it('ignores synthetic gestures, taps and a closed keyboard', () => {
    expect(shouldDismissFoodKeyboard(false, 336, 20)).toBe(false);
    expect(shouldDismissFoodKeyboard(true, 336, 0)).toBe(false);
    expect(shouldDismissFoodKeyboard(true, 336, 5)).toBe(false);
    expect(shouldDismissFoodKeyboard(true, 0, 20)).toBe(false);
  });
});