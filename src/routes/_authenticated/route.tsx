import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomTabs } from "@/components/BottomTabs";
import { TimezoneSync } from "@/components/TimezoneSync";
import { TrialEndedPaywall } from "@/components/TrialEndedPaywall";

const TRIAL_DAYS = 7;

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
  const hideTabs =
    pathname.startsWith("/check-in/") ||
    pathname === "/invite" ||
    pathname === "/new-pactara" ||
    /^\/chat\/[^/]+/.test(pathname);

  const [trialState, setTrialState] = useState<{
    expired: boolean;
    firstName: string | null;
    daysActive: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at, name")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !profile) return;
      const created = new Date(profile.created_at).getTime();
      const now = Date.now();
      const daysActive = Math.max(0, Math.floor((now - created) / 86400000));
      const expired = now - created > TRIAL_DAYS * 86400000;
      const firstName = (profile.name || "").split(" ")[0] || null;
      setTrialState({ expired, firstName, daysActive });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TimezoneSync />
      <Outlet />
      {!hideTabs && <BottomTabs />}
      {trialState?.expired && (
        <TrialEndedPaywall
          firstName={trialState.firstName}
          daysActive={trialState.daysActive}
        />
      )}
    </>
  );
}
