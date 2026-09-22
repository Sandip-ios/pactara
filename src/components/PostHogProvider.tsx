import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { supabase } from "@/integrations/supabase/client";
import { recordAppOpen } from "@/lib/admin/analytics.functions";
import { isNative } from "@/lib/native";


const POSTHOG_KEY = "phc_tzge9caFkSUQFm2wmShenqMqLWKoytNvzfkjdJsdjeLw";
const POSTHOG_HOST = "https://us.i.posthog.com";

let initialized = false;

export function PostHogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || initialized) return;
    initialized = true;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
    posthog.capture("$pageview");

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        posthog.identify(data.user.id, { email: data.user.email });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      } else if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);


  // Records app opens for the founder dashboard. One open per 30 minutes of
  // foreground activity, so a quick tab switch doesn't inflate the number.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "last-app-open-recorded";
    const platform = isNative() ? "native" : "web";

    const track = async () => {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      localStorage.setItem(KEY, String(Date.now()));
      try {
        await recordAppOpen({ data: { platform } });
      } catch {
        // analytics must never break the app
      }
    };

    void track();
    const onVisible = () => {
      if (document.visibilityState === "visible") void track();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => {
      if (initialized) posthog.capture("$pageview");
    });
    return () => unsub();
  }, [router]);



  return <>{children}</>;
}
