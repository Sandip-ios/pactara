import { describe, expect, it } from 'vitest';
import { mealBuilderReturn } from '../meal-builder-return';

describe('meal builder dismissal', () => {
  for (const href of ['/home', '/discover/meals?q=rice&type=All', '/post/compose', '/profile?tab=meals']) {
    it(`returns to ${href} with its original scroll instead of Profile`, () => {
      expect(mealBuilderReturn({ href, index: 8, windowY: 2, scroll: [327] }, 9, href === '/post/compose'))
        .toEqual({ back: true, href, windowY: 2, scroll: [327] });
    });
  }
  it('uses the captured URL, not unrelated history, after another entry', () => {
    expect(mealBuilderReturn({ href: '/home?group=abc', index: 8, windowY: 0, scroll: [145] }, 11, false))
      .toEqual({ back: false, href: '/home?group=abc', windowY: 0, scroll: [145] });
  });
  it('keeps direct-link fallbacks local', () => {
    expect(mealBuilderReturn(null, 0, true).href).toBe('/post/compose');
    expect(mealBuilderReturn({ href: '//external.example', index: 0, windowY: 0, scroll: [] }, 1, false).href).toBe('/profile?tab=meals');
  });
});