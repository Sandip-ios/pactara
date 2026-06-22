import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Supabase session lives in localStorage — only available client-side.
    // On the server the gate is a no-op; the client beforeLoad runs after
    // hydration and redirects unauthenticated users.
    if (typeof window === "undefined") return {};
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
