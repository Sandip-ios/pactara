import { createFileRoute } from "@tanstack/react-router";
import { useAdmin } from "@/lib/admin/context";
import { InsightCallout, PageHeader, Panel } from "@/components/admin/kit";
import { RANGE_LABELS } from "@/lib/admin/analytics-data";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data, range } = useAdmin();

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="How this dashboard is set up." />

      <Panel title="Access">
        <p className="text-sm text-muted-foreground">
          This page opens only with your private link. The link is remembered on this device, so you can bookmark
          plain <span className="font-mono text-foreground">/admin</span> after the first visit. Anyone without the
          link sees a locked screen, and search engines are told to ignore the page.
        </p>
        <div className="mt-4">
          <InsightCallout title="If the link ever leaks">
            Ask me to rotate it and the old link stops working immediately.
          </InsightCallout>
        </div>
      </Panel>

      <Panel title="Privacy">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>· Only counts and rates are shown here, never check-in photos or videos.</li>
          <li>· Group names appear so you can spot which ones are struggling.</li>
          <li>· Individual notes, messages and comments are never read by this dashboard.</li>
        </ul>
      </Panel>

      <Panel title="App Store downloads">
        <p className="text-sm text-muted-foreground">
          {data.acquisition.hasAppStore
            ? "Connected. Daily download numbers refresh automatically."
            : "Not connected yet. Everything else on this dashboard is live; download counts need App Store Connect access before they can appear."}
        </p>
      </Panel>

      <Panel title="Current view">
        <p className="text-sm text-muted-foreground">
          Showing {RANGE_LABELS[range]} · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </Panel>
    </div>
  );
}
