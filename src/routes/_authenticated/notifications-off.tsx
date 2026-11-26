import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewNotifSettings } from "@/components/redesign/NewNotifSettings";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/notifications-off")({
  head: () => ({ meta: [
    { title: "Turn on notifications · Pactara" },
    { name: "description", content: "Turn Pactara notifications back on in your iPhone Settings." },
    { property: "og:title", content: "Turn on notifications · Pactara" },
    { property: "og:description", content: "Turn Pactara notifications back on in your iPhone Settings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: NotificationsOffRoute,
});

function NotificationsOffRoute() {
  const version = useAppVersion(), prefs = useAppPrefs();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewNotifSettings /> : <Navigate to="/home" replace />;
}
