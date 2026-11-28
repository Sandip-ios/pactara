import { useRouter } from '@tanstack/react-router';
import { mealBuilderReturn, mealBuilderSaveReturnsHome, type MealBuilderOrigin } from './meal-builder-return';

const key = 'pactara:meal-builder-origin';

/** Capture before navigation; Cancel/Discard and Home saves restore the exact page, query and scroll. */
export function useMealBuilderNavigation() {
  const router = useRouter();
  const openMealBuilder = ({ mealId, forPost = false }: { mealId?: string; forPost?: boolean } = {}) => {
    const origin: MealBuilderOrigin = {
      href: router.state.location.href,
      index: router.state.location.state.__TSR_index ?? 0,
      windowY: window.scrollY,
      scroll: Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-root]'), element => element.scrollTop),
    };
    sessionStorage.setItem(key, JSON.stringify(origin));
    return mealId
      ? router.navigate({ to: '/meals/$mealId/edit', params: { mealId } })
      : router.navigate({ to: '/meals/new', search: { forPost } });
  };
  const closeMealBuilder = (forPost: boolean, onRestored?: () => void) => {
    let origin: MealBuilderOrigin | null = null;
    try { origin = JSON.parse(sessionStorage.getItem(key) ?? 'null') as MealBuilderOrigin | null; } catch { /* Direct link has no opening page. */ }
    sessionStorage.removeItem(key);
    const destination = mealBuilderReturn(origin, router.state.location.state.__TSR_index ?? 0, forPost);
    const unsubscribe = router.subscribe('onRendered', () => {
      unsubscribe();
      // Run after router restoration and the destination's open-at-top layout effect.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo(0, destination.windowY);
        document.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach((element, index) => {
          element.scrollTop = destination.scroll[index] ?? 0;
        });
        onRestored?.();
      }));
    });
    if (destination.back) router.history.back();
    else void router.navigate({ href: destination.href, replace: true, resetScroll: false });
  };
  const returnHomeAfterSave = (forPost: boolean, onRestored: () => void) => {
    let origin: MealBuilderOrigin | null = null;
    try { origin = JSON.parse(sessionStorage.getItem(key) ?? 'null') as MealBuilderOrigin | null; } catch { /* Not opened from Home. */ }
    if (!mealBuilderSaveReturnsHome(origin, forPost)) return false;
    closeMealBuilder(forPost, onRestored);
    return true;
  };
  return { openMealBuilder, closeMealBuilder, returnHomeAfterSave };
}