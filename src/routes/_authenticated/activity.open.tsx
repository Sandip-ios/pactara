import { useEffect } from "react";
import { createFileRoute, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useVersionToast } from "@/components/redesign/new-toast";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { ACTIVITY_UNAVAILABLE, type ActivityDeepLinkKind } from "@/lib/activity-deeplink";
import { resolveActivityDeepLink } from "@/lib/activity-deeplink.functions";
import { beginNewCheckIn } from "@/lib/redesign-checkin";

export const Route = createFileRoute("/_authenticated/activity/open")({
  validateSearch: (search: Record<string, unknown>) => ({
    kind: typeof search.kind === "string" ? search.kind : "",
    groupId: typeof search.group === "string" ? search.group : undefined,
    postId: typeof search.post === "string" ? search.post : undefined,
    commentId: typeof search.comment === "string" ? search.comment : undefined,
    actorId: typeof search.actor === "string" ? search.actor : undefined,
    requestId: typeof search.request === "string" ? search.request : undefined,
  }),
  head: () => ({ meta: [
    { title: "Open Activity · Pactara" },
    { name: "description", content: "Open the exact Pactara Activity destination." },
    { property: "og:title", content: "Open Activity · Pactara" },
    { property: "og:description", content: "Open the exact Pactara Activity destination." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ActivityOpenRoute,
});

function ActivityOpenRoute() {
  const version = useAppVersion();
  const toast = useVersionToast();
  const prefs = useAppPrefs();
  const search = Route.useSearch();
  const searchStr = useRouterState({ select: state => state.location.searchStr });
  const navigate = useNavigate();
  const resolve = useServerFn(resolveActivityDeepLink);

  useEffect(() => {
    if (!prefs.isSuccess || version !== "new") return;
    let current = true;
    void resolve({ data: {
      kind: search.kind as ActivityDeepLinkKind,
      groupId: search.groupId,
      postId: search.postId,
      commentId: search.commentId,
      actorId: search.actorId,
      requestId: search.requestId,
    } }).then(destination => {
      if (!current) return;
      if (destination.checkInGroupId) {
        beginNewCheckIn(destination.checkInGroupId, null, false);
        void navigate({ href: `/check-in?group=${destination.checkInGroupId}`, replace: true });
        return;
      }
      if (destination.href) {
        void navigate({ href: destination.href, replace: true });
        return;
      }
      toast.error(ACTIVITY_UNAVAILABLE);
      void navigate({ to: "/activity", replace: true });
    }).catch(() => {
      if (!current) return;
      toast.error(ACTIVITY_UNAVAILABLE);
      void navigate({ to: "/activity", replace: true });
    });
    return () => { current = false; };
    // The serialized URL is the trigger; the validated object is rebuilt by the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr, prefs.isSuccess, version, resolve]);

  if (prefs.isSuccess && version === "classic") return <Navigate to="/notifications" replace />;
  return <div className="redesign-step3 fixed inset-0 bg-[var(--new-bg)]" aria-label="Opening Activity" />;
}
