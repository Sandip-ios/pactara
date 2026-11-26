import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomTabs } from "@/components/BottomTabs";
import { NewBottomTabs } from "@/components/redesign/NewBottomTabs";
import { WhatsNewScreen } from "@/components/redesign/WhatsNewScreen";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { WorkoutBar } from "@/components/workout/WorkoutBar";
import { TimezoneSync } from "@/components/TimezoneSync";
import { TrialEndedPaywall } from "@/components/TrialEndedPaywall";
import { areBottomTabsHidden, subscribeBottomTabsHidden } from "@/hooks/use-hide-bottom-tabs";
import { getPendingPact } from "@/lib/pact.functions";
import { getPendingGoal } from "@/lib/member-goal.functions";
import { getPartnerState } from "@/lib/partners.functions";
import { hasActiveMembership } from "@/lib/membership";
import { didStartupChecksRun, useLaunchHold } from "@/lib/launch-screen";
import { setLayoutOverlayState } from "@/lib/app-overlays";

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

// Once the start-up check has resolved in this session it re-runs silently on
// later navigations. On a cold launch the entry screen already ran it (in
// parallel, behind the launch screen), so the first run here is skipped.
let pactCheckResolved = false;
// Checked once per app launch so users can still leave the match screen.
let matchCheckDone = false;
// The launch's own run of the checks stands in for the first run here.
let launchChecksConsumed = false;

function AuthLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const onGoalRoute = pathname.startsWith("/goal/");
  const onPactRoute = pathname.startsWith("/pact/") || onGoalRoute;
  const [pactChecked, setPactChecked] = useState(() => pactCheckResolved || didStartupChecksRun());
  // Opened straight onto an app screen (not via the entry): keep the launch
  // screen up until this check says where to go, so nothing flashes first.
  useLaunchHold(!onPactRoute && !pactChecked);

  // Everyone sets a personal goal, then signs the group pact, before the app.
  useEffect(() => {
    if (onPactRoute) return;
    if (didStartupChecksRun() && !launchChecksConsumed) {
      launchChecksConsumed = true;
      pactCheckResolved = true;
      matchCheckDone = true;
      setPactChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const checkMatch = !matchCheckDone && pathname !== "/partner";
        if (checkMatch) matchCheckDone = true;
        const [goalRes, res, ps] = await Promise.all([
          getPendingGoal().catch(() => null),
          getPendingPact().catch(() => null),
          checkMatch ? getPartnerState().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (goalRes?.groupId) {
          navigate({ to: "/goal/$groupId", params: { groupId: goalRes.groupId }, replace: true });
          return;
        }
        if (res?.groupId) {
          navigate({ to: "/pact/$groupId", params: { groupId: res.groupId }, replace: true });
          return;
        }
        // App reopened with a match waiting for this user → show the match.
        if (ps?.status === "pending" && ps.partnership && !ps.partnership.iAccepted) {
          navigate({ to: "/partner", search: { solo: undefined }, replace: true });
          return;
        }
      } catch {
        /* ignore — never block the app on this check */
      }
      if (cancelled) return;
      pactCheckResolved = true;
      setPactChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, onPactRoute, navigate]);

  // New members see the intro offer once, after the pact / partner screens.
  const [introPaywall, setIntroPaywall] = useState(false);

  const tabsHiddenByModal = useSyncExternalStore(
    subscribeBottomTabsHidden,
    areBottomTabsHidden,
    () => false,
  );
  const appVersion = useAppVersion();
  const appPrefs = useAppPrefs();
  const hideTabs =
    tabsHiddenByModal ||
    (appVersion === "new" && (
      pathname === "/account-settings" ||
      pathname.startsWith("/account-settings/")
    )) ||
    pathname.startsWith("/check-in/") ||
    pathname.startsWith("/pact/") ||
    pathname.startsWith("/goal/") ||
    pathname === "/partner" ||
    pathname === "/new-pactara" ||
    pathname === "/find-plan" ||
    pathname.startsWith("/plans/") ||
    pathname === "/workout" ||
    pathname.startsWith("/workout/") ||
    pathname.startsWith("/exercises/") ||
    pathname.startsWith("/chat");

  const [trialState, setTrialState] = useState<{
    expired: boolean;
    subscribed: boolean;
    firstName: string | null;
    daysActive: number;
    loading: boolean;
  } | null>({ expired: false, subscribed: false, firstName: null, daysActive: 0, loading: true });

  // Show the one-time intro paywall (queued by signup) once we're inside the
  // app — but never to someone who already has an active membership.
  useEffect(() => {
    if (onPactRoute || pathname === "/partner" || !pactChecked) return;
    if (trialState === null || trialState.loading) return; // wait for the subscription check
    if (trialState.subscribed) {
      try { localStorage.removeItem("show-intro-paywall"); } catch { /* ignore */ }
      return;
    }
    if (typeof localStorage !== "undefined" && localStorage.getItem("show-intro-paywall") === "1") {
      setIntroPaywall(true);
    }
  }, [pathname, onPactRoute, pactChecked, trialState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        if (!cancelled) setTrialState({ expired: false, subscribed: false, firstName: null, daysActive: 0, loading: false });
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

      const subscribed = await hasActiveMembership(userId);


      // Debug override: append ?paywall=1 to any URL, or set localStorage.pactara-force-paywall=1
      const forced =
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("paywall") === "1") ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("pactara-force-paywall") === "1");
      const expired = forced || (!subscribed && now - created > TRIAL_DAYS * 86400000);

      const firstName = (profile?.name || auth.user?.user_metadata?.name || "").split(" ")[0] || null;
      setTrialState({ expired, subscribed, firstName, daysActive, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lets Home hold one-time sheets while a paywall is up or still being decided.
  useEffect(() => {
    setLayoutOverlayState({
      pending: !trialState || trialState.loading,
      blocking: introPaywall || Boolean(trialState?.expired),
    });
  }, [trialState, introPaywall]);

  return (
    <>
      <TimezoneSync />
      <Outlet />
      {!hideTabs && (appVersion === "new" ? <NewBottomTabs /> : <BottomTabs />)}
      {appVersion === "new" && appPrefs.isSuccess && !appPrefs.data?.new_version_seen_at && <WhatsNewScreen />}
      <WorkoutBar tabsVisible={!hideTabs} />
      {introPaywall && !(trialState?.expired) && (
        <TrialEndedPaywall
          firstName={trialState?.firstName ?? null}
          mode="intro"
          onDismiss={() => {
            localStorage.removeItem("show-intro-paywall");
            setIntroPaywall(false);
          }}
        />
      )}
      {trialState && !trialState.loading && trialState.expired && (
        <TrialEndedPaywall firstName={trialState.firstName} daysActive={trialState.daysActive} />
      )}
    </>
  );
}
