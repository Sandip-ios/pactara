import type { OnboardingPath, OnboardingStep } from "./onboarding-analytics.functions";

const JOURNEY_KEY = "onboarding-journey-id";
const PATH_KEY = "onboarding-journey-path";

export function getOnboardingJourney(path?: OnboardingPath) {
  if (typeof localStorage === "undefined") return null;
  let journeyId = localStorage.getItem(JOURNEY_KEY);
  if (!journeyId) {
    journeyId = crypto.randomUUID();
    localStorage.setItem(JOURNEY_KEY, journeyId);
  }
  if (path) localStorage.setItem(PATH_KEY, path);
  const storedPath = localStorage.getItem(PATH_KEY);
  return {
    journeyId,
    path: storedPath === "invitee" ? "invitee" : "creator",
  } satisfies { journeyId: string; path: OnboardingPath };
}

export function readOnboardingJourney() {
  if (typeof localStorage === "undefined") return null;
  const journeyId = localStorage.getItem(JOURNEY_KEY);
  if (!journeyId) return null;
  return getOnboardingJourney();
}

export function clearOnboardingJourney() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(JOURNEY_KEY);
  localStorage.removeItem(PATH_KEY);
}

export function signupStepToAnalytics(step: string): OnboardingStep | null {
  const map: Record<string, OnboardingStep> = {
    name: "name",
    email: "email",
    photo: "photo",
    consistency: "consistency",
    commitment: "duration",
    group: "group_name",
    company: "social_proof",
    password: "password",
    invite: "invite_friends",
    notify: "notifications",
    greeting: "greeting",
    paywall: "paywall",
    personalGoal: "personal_goal",
  };
  return map[step] ?? null;
}