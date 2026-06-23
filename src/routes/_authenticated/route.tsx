import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomTabs } from "@/components/BottomTabs";
import { TimezoneSync } from "@/components/TimezoneSync";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    return { user: data.session.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideTabs = pathname.startsWith("/check-in/") || pathname === "/invite" || /^\/chat\/[^/]+/.test(pathname);
  return (
    <>
      <TimezoneSync />
      <Outlet />
      {!hideTabs && <BottomTabs />}
    </>
  );
}
