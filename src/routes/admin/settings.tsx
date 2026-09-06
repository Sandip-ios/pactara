import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SettingsPage,
});

function Toggle({
  label,
  description,
  defaultOn = true,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-4 last:border-0">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        aria-pressed={on}
        className={cn(
          "h-6 w-11 shrink-0 rounded-full p-0.5 transition",
          on ? "bg-pactara-purple" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "block size-5 rounded-full bg-white shadow transition",
            on && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="How this dashboard reads and reports your data." />

      <Panel title="Data source">
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          This dashboard is currently running on <strong>labelled demo data</strong> so every chart can be
          evaluated before launch. All pages read from one data layer, so switching to live analytics does not
          change any screen — only the source.
        </div>
        <div className="mt-4 space-y-1">
          <Toggle
            label="Use live analytics"
            description="Read from the product event stream instead of demo data. Available once the tracking plan on the Events page is shipped."
            defaultOn={false}
          />
          <Toggle
            label="Exclude internal accounts"
            description="Drop team and test accounts from every metric."
          />
          <Toggle
            label="Hide personal content"
            description="Never load check-in notes, photos or video into analytics views. Metadata only."
          />
        </div>
      </Panel>

      <Panel title="Thresholds" description="Where a metric turns from Healthy to Watch to Needs attention.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-left">Healthy</th>
                <th className="px-3 py-2 text-left">Watch</th>
                <th className="px-3 py-2 text-left">Needs attention</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Activation rate", "≥ 45%", "30–45%", "< 30%"],
                ["D7 retention", "≥ 32%", "22–32%", "< 22%"],
                ["D30 retention", "≥ 22%", "15–22%", "< 15%"],
                ["Commitment completion", "≥ 55%", "40–55%", "< 40%"],
                ["Active group rate", "≥ 55%", "40–55%", "< 40%"],
                ["Invite acceptance", "≥ 60%", "45–60%", "< 45%"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-border/40">
                  {r.map((c, i) => (
                    <td key={i} className={cn("px-3 py-2", i === 0 && "font-semibold")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Alerts">
        <div className="space-y-1">
          <Toggle label="Retention drops over 20%" description="Alert when D7 or D30 falls sharply versus the previous cohort." />
          <Toggle label="Activation or invite acceptance drops" description="Alert on meaningful declines in the launch funnel." />
          <Toggle label="Check-in failures by app version" description="Alert when a release performs worse than the previous one." />
          <Toggle label="Positive changes" description="Also surface improvements worth doubling down on." />
        </div>
      </Panel>

      <Panel title="Access">
        <p className="text-sm text-muted-foreground">
          This dashboard is internal and excluded from search engines. Before launch, put it behind an admin
          role check so only founder accounts can open it.
        </p>
      </Panel>
    </div>
  );
}
