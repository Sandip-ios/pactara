import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/native";
import { getPendingInvite, setPendingInvite, wasInviteConsumed } from "@/lib/pending-invite";
import { getLaunchInviteGroupId, getLaunchLinkPath } from "@/lib/native-launch";
import { claimDeferredInvite } from "@/lib/deferred-invite";
import { getSignupResume } from "@/lib/signup-resume";
import { getPendingGoal } from "@/lib/member-goal.functions";
import { getPendingPact } from "@/lib/pact.functions";
import { getPartnerState } from "@/lib/partners.functions";
import { noteLaunchLink, takeLaunchLink } from "@/lib/launch-links";
import { decideLaunch, type LaunchDestination } from "@/lib/launch-route";
import { markStartupChecksRan } from "@/lib/launch-screen";
import { homeCrewQuery, myGroupsQuery } from "@/lib/home-queries";
import { groupFeedQuery } from "@/components/feed/use-group-feed";
import { parseFeedDeepLink } from "@/lib/feed-deeplink";

const orNull = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

/** Native calls that never answer must not hold the launch. */
function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}
const NATIVE_CALL_MS = 1000;

async function inviteAtLaunch(native: boolean): Promise<string | null> {
  if (!native) return null;
  const launchGroupId = await getLaunchInviteGroupId();
  if (launchGroupId) {
    setPendingInvite(launchGroupId);
    return launchGroupId;
  }
  // Installed from the App Store after tapping an invite in Safari: the
  // launch URL is empty, so ask the server for the deferred invite.
  const pending = getPendingInvite();
  if (pending && !wasInviteConsumed(pending)) return pending;
  const claimed = await orNull(claimDeferredInvite());
  if (claimed && !wasInviteConsumed(claimed)) {
    setPendingInvite(claimed);
    return claimed;
  }
  return null;
}

/** Home's first data, fetched while the launch screen is still up. */
function prefetchHome(queryClient: QueryClient) {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("active-group-id");
  } catch {
    /* ignore */
  }
  // A returning member's crew is known already: fetch it alongside the list.
  if (stored) {
    void queryClient.prefetchQuery(homeCrewQuery(stored));
    void queryClient.prefetchInfiniteQuery(groupFeedQuery(stored));
  }
  void (async () => {
    try {
      const groups = await queryClient.fetchQuery(myGroupsQuery());
      const list = (groups as { groups?: { id: string }[] } | null)?.groups ?? [];
      if (list.length === 0 || (stored && list.some((g) => g.id === stored))) return;
      await queryClient.prefetchQuery(homeCrewQuery(list[0]!.id));
    } catch {
      /* Home loads it itself */
    }
  })();
}

/**
 * Everything the cold launch needs to pick its first screen, all at once:
 * session, invite / tapped notification / opened link, and the start-up
 * checks (goal, pact, partner match) in parallel.
 */
export async function resolveLaunch(queryClient: QueryClient): Promise<LaunchDestination> {
  try {
    performance.mark("pactara-launch-start");
  } catch {
    /* ignore */
  }
  const native = isNative();
  // Links / invite (native calls) and the session start together; the
  // start-up checks start the moment the session is known, without waiting
  // for the link answers, so nothing here runs one after another.
  const inviteP = within(inviteAtLaunch(native), NATIVE_CALL_MS * 2, null);
  const tappedP = native ? within(takeLaunchLink(), NATIVE_CALL_MS, null) : Promise.resolve(null);
  const openedP = native ? within(getLaunchLinkPath(), NATIVE_CALL_MS, null) : Promise.resolve(null);
  const sessionRes = await supabase.auth.getSession();
  const signedIn = !!sessionRes.data.session;
  const resume = signedIn ? getSignupResume() : null;

  if (signedIn && !resume) prefetchHome(queryClient);
  const checksP =
    signedIn && !resume
      ? Promise.all([orNull(getPendingGoal()), orNull(getPendingPact()), orNull(getPartnerState())])
      : null;
  const [invite, tapped, opened] = await Promise.all([inviteP, tappedP, openedP]);
  const linkPath = tapped ?? opened;
  // A tapped feed notification: start loading that crew's feed right away.
  const linkGroup = signedIn && linkPath?.startsWith("/home?") ? parseFeedDeepLink(linkPath.slice(5)).group : undefined;
  if (linkGroup) {
    void queryClient.prefetchQuery(homeCrewQuery(linkGroup));
    void queryClient.prefetchInfiniteQuery(groupFeedQuery(linkGroup));
  }

  let goalGroupId: string | null = null;
  let pactGroupId: string | null = null;
  let partnerPending = false;
  if (checksP && !invite && !linkPath) {
    const [goal, pact, partner] = await checksP;
    goalGroupId = goal?.groupId ?? null;
    pactGroupId = pact?.groupId ?? null;
    partnerPending = partner?.status === "pending" && !!partner.partnership && !partner.partnership.iAccepted;
    markStartupChecksRan();
  }
  // A tapped notification or link wins at launch (priority order), so the
  // goal / pact / partner checks are skipped for this launch, as before when
  // the app layout ran them once per session.
  if (signedIn && linkPath) markStartupChecksRan();
  if (linkPath) noteLaunchLink(linkPath);
  try {
    performance.mark("pactara-launch-decided");
  } catch {
    /* ignore */
  }
  return decideLaunch({
    native,
    signedIn,
    inviteGroupId: invite,
    linkPath,
    signupResume: resume ? { onPartner: !!resume.onPartner, groupId: resume.groupId ?? null } : null,
    goalGroupId,
    pactGroupId,
    partnerPending,
  });
}
