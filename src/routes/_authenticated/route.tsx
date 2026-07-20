import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomTabs } from "@/components/BottomTabs";
import { TimezoneSync } from "@/components/TimezoneSync";
import { TrialEndedPaywall } from "@/components/TrialEndedPaywall";
import { areBottomTabsHidden, subscribeBottomTabsHidden } from "@/hooks/use-hide-bottom-tabs";
import { getCustomerInfo, isSubscriptionActive } from "@/lib/revenuecat";
import { isNative } from "@/lib/native";

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
  const tabsHiddenByModal = useSyncExternalStore(
    subscribeBottomTabsHidden,
    areBottomTabsHidden,
    () => false,
  );
  const hideTabs =
    tabsHiddenByModal ||
    pathname.startsWith("/check-in/") ||
    pathname === "/new-pactara" ||
    /^\/chat\/[^/]+/.test(pathname);

  const [trialState, setTrialState] = useState<{
    expired: boolean;
    firstName: string | null;
    daysActive: number;
    loading: boolean;
  } | null>({ expired: false, firstName: null, daysActive: 0, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        if (!cancelled) setTrialState({ expired: false, firstName: null, daysActive: 0, loading: false });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at, name")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;

      const dateCandidates = [auth.user?.created_at, profile?.created_at]
        .map((date) => (date ? new Date(date).getTime() : Number.NaN))
        .filter((time) => Number.isFinite(time) && time > 0);
      const created = dateCandidates.length ? Math.min(...dateCandidates) : Date.now();
      const now = Date.now();
      const daysActive = Math.max(0, Math.floor((now - created) / 86400000));

      let subscribed = false;
      if (isNative()) {
        try {
          const customerInfo = await getCustomerInfo();
          subscribed = isSubscriptionActive(customerInfo);
        } catch (err) {
          console.error("[auth-layout] RevenueCat subscription check failed", err);
        }
      } else {
        subscribed =
          typeof localStorage !== "undefined" && localStorage.getItem("pactara-subscribed") === "1";
      }

      // Debug override: append ?paywall=1 to any URL, or set localStorage.pactara-force-paywall=1
      const forced =
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("paywall") === "1") ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("pactara-force-paywall") === "1");
      const expired = forced || (!subscribed && now - created > TRIAL_DAYS * 86400000);
      const firstName = (profile?.name || auth.user?.user_metadata?.name || "").split(" ")[0] || null;
      setTrialState({ expired, firstName, daysActive, loading: false });
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
      {trialState && !trialState.loading && trialState.expired && (
        <TrialEndedPaywall firstName={trialState.firstName} daysActive={trialState.daysActive} />
      )}
    </>
  );
}
