import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ONBOARDING_STEPS = [
  "name",
  "email",
  "photo",
  "consistency",
  "duration",
  "group_name",
  "social_proof",
  "password",
  "account_created",
  "invite_friends",
  "notifications",
  "greeting",
  "paywall",
  "personal_goal",
  "pact",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingPath = "creator" | "invitee";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validate(input: { journeyId: string; path: OnboardingPath; step: OnboardingStep }) {
  const journeyId = String(input?.journeyId ?? "").trim();
  if (!uuidPattern.test(journeyId)) throw new Error("Invalid onboarding journey");
  if (input.path !== "creator" && input.path !== "invitee") throw new Error("Invalid onboarding path");
  if (!ONBOARDING_STEPS.includes(input.step)) throw new Error("Invalid onboarding step");
  return { journeyId, path: input.path, step: input.step };
}

/** Records pre-account screens without storing names, emails, or entered answers. */
export const recordAnonymousOnboardingStep = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("onboarding_step_events").upsert(
      {
        journey_id: data.journeyId,
        path: data.path,
        step: data.step,
      },
      { onConflict: "journey_id,step", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Attaches the signed-in account to its journey and records the current screen. */
export const recordAuthenticatedOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: linkError } = await supabaseAdmin
      .from("onboarding_step_events")
      .update({ user_id: context.userId })
      .eq("journey_id", data.journeyId);
    if (linkError) throw new Error(linkError.message);

    const { error } = await supabaseAdmin.from("onboarding_step_events").upsert(
      {
        journey_id: data.journeyId,
        user_id: context.userId,
        path: data.path,
        step: data.step,
      },
      { onConflict: "journey_id,step", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
