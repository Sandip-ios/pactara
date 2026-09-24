import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Show cached data instantly when returning to a screen, refresh behind it.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Load the route's code as soon as the user touches a link/tab.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 30_000,
  });

  // Remember the previous in-app screen so "back" can avoid auth pages.
  if (typeof window !== "undefined") {
    router.subscribe("onResolved", ({ fromLocation, toLocation }) => {
      if (fromLocation && fromLocation.pathname !== toLocation.pathname) {
        sessionStorage.setItem("pactara:prev-path", fromLocation.pathname);
      }
    });
  }

  return router;
};
