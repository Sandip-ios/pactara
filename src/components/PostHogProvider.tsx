import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import posthog from "posthog-js";
import { supabase } from "@/integrations/supabase/client";


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
  }, []);

  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => {
      if (initialized) posthog.capture("$pageview");
    });
    return () => unsub();
  }, [router]);

  return <>{children}</>;
}
