import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/hooks/warm-foods')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMealFoodWarm } = await import('@/lib/meal-food-warm.server');
        return handleMealFoodWarm(request);
      },
    },
  },
});