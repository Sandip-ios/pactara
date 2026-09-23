import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAdmin } from "@/lib/admin/context";
import {
  BarList,
  EmptyNote,
  FunnelStepChart,
  FunnelView,
  InsightCallout,
  PageHeader,
  Panel,
  StatTile,
} from "@/components/admin/kit";
import { pct } from "@/lib/admin/analytics-data";

export const Route = createFileRoute("/admin/funnel")({
  head: () => ({
    meta: [
      { title: "Launch funnel · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FunnelPage,
});

function FunnelPage() {
  const { data } = useAdmin();
  const [path, setPath] = useState<"creator" | "invitee">("creator");
  const stages = data.onboarding[path];

  let leak: { from: string; to: string; pct: number; lost: number } | null = null;
  for (let i = 1; i < stages.length; i++) {
    const lost = stages[i - 1].users - stages[i].users;
    const p = pct(lost, stages[i - 1].users);
    if (!leak || p > leak.pct) leak = { from: stages[i - 1].label, to: stages[i].label, pct: p, lost };
  }

  const byId = Object.fromEntries(data.activationFunnel.map((s) => [s.id, s.users]));
  const acct = byId.account ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Onboarding funnel"
        subtitle="Where people stop during Pactara’s actual signup flow."
      />

      <div className="inline-flex rounded-xl bg-muted p-1" aria-label="Onboarding path">
        {(["creator", "invitee"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPath(item)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              path === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {item === "creator" ? "Creates a group" : "Joins by invite"}
          </button>
        ))}
      </div>

      {!data.onboarding.trackingStartedAt && (
        <InsightCallout title="Tracking starts now">
          Exact screen-by-screen data will appear as new people begin signup after this update.
        </InsightCallout>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel
            title="Step-by-step conversion"
            description="How many people who reached a step went on to the next one. The weakest step is highlighted."
          >
            <FunnelStepChart stages={stages} />
          </Panel>

          <Panel title="Every onboarding screen" description="Counts are unique signup journeys started in the selected period.">
            <FunnelView stages={stages} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Biggest drop-off">
            {leak && leak.lost > 0 ? (
              <>
                <InsightCallout tone="bad" title="Largest point of friction">
                  {leak.from} → {leak.to}: {leak.lost.toLocaleString()} people lost,{" "}
                  {Math.round(leak.pct * 100)}% drop-off.
                </InsightCallout>
                <p className="mt-4 text-sm font-semibold">Worth investigating</p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Review the screen’s copy, required action, and any permission prompt at this transition.
                </p>
              </>
            ) : (
              <EmptyNote>Not enough signups in this period to spot a drop-off.</EmptyNote>
            )}
          </Panel>

          <Panel title="Activation">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Account → group"
                value={`${Math.round(pct(byId.group ?? 0, acct) * 100)}%`}
              />
              <StatTile
                label="Group → goal set"
                value={`${Math.round(pct(byId.goal ?? 0, byId.group ?? 0) * 100)}%`}
              />
              <StatTile
                label="Goal → pact signed"
                value={`${Math.round(pct(byId.pact ?? 0, byId.goal ?? 0) * 100)}%`}
              />
              <StatTile
                label="Overall activation"
                value={`${Math.round(pct(byId.checkin ?? 0, acct) * 100)}%`}
                sub="account → first proof check-in"
              />
            </div>
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">Time from signup to first check-in</p>
              {data.timeToActivation.length ? (
                <BarList items={data.timeToActivation} format="number" />
              ) : (
                <EmptyNote>No activated signups in this period.</EmptyNote>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Post-onboarding activation" description="Durable milestones after signup, shown separately from onboarding screens.">
        <FunnelView stages={data.activationFunnel} />
      </Panel>

      <Panel title="Downloads and signups" description="Where the top of the funnel comes from.">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="App Store downloads"
            value={data.acquisition.hasAppStore ? data.acquisition.downloadsTotal.toLocaleString() : "Not connected"}
          />
          <StatTile label="New accounts" value={data.acquisition.signupsTotal.toLocaleString()} />
          <StatTile
            label="Download → account"
            value={
              data.acquisition.downloadToSignup === null
                ? "—"
                : `${Math.round(data.acquisition.downloadToSignup * 100)}%`
            }
          />
        </div>
        {!data.acquisition.hasAppStore && (
          <div className="mt-4">
            <InsightCallout title="Download numbers">
              Download counts need an App Store Connect connection. Everything else on this page already uses
              real data.
            </InsightCallout>
          </div>
        )}
      </Panel>
    </div>
  );
}
