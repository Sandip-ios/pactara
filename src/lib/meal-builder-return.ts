export interface MealBuilderOrigin {
  href: string;
  index: number;
  windowY: number;
  scroll: number[];
}

/** Home saves restore the opening spot; post attachment and other Save flows stay unchanged. */
export function mealBuilderSaveReturnsHome(origin: MealBuilderOrigin | null, forPost: boolean) {
  return !forPost && origin?.href.split(/[?#]/)[0] === '/home';
}

/** Only step back when that history entry is the captured opening page. */
export function mealBuilderReturn(origin: MealBuilderOrigin | null, currentIndex: number, forPost: boolean) {
  if (origin && origin.href.startsWith('/') && !origin.href.startsWith('//') && !origin.href.startsWith('/meals/')) {
    return { back: currentIndex === origin.index + 1, href: origin.href, windowY: origin.windowY, scroll: origin.scroll };
  }
  return { back: false, href: forPost ? '/post/compose' : '/profile?tab=meals', windowY: 0, scroll: [] };
}