import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAdmin } from "./route";
import { BarList, FunnelView, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/funnel")({
  head: () => ({
    meta: [
      { title: "Launch funnel · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FunnelPage,
});

const SEGMENTS = [
  "All new users",
  "Organic",
  "Paid acquisition",
  "Invite / referral",
  "Creator campaign",
  "App Store",
  "iOS 18",
  "United States",
  "Group size 3+",
];

function FunnelPage() {
  const { data } = useAdmin();
  const [segment, setSegment] = useState(SEGMENTS[0]);

  // Biggest leak
  let leak = { from: data.funnel[0], to: data.funnel[1], pct: 0, lost: 0 };
  for (let i = 1; i < data.funnel.length; i++) {
    const lost = data.funnel[i - 1].users - data.funnel[i].users;
    const pct = lost / data.funnel[i - 1].users;
    if (pct > leak.pct) leak = { from: data.funnel[i - 1], to: data.funnel[i], pct, lost };
  }

  const acct = data.funnel[1].users;
  const group = data.funnel[2].users;
  const commit = data.funnel[4].users;
  const checkin = data.funnel[5].users;

  return (
    <div className="space-y-8">
      <PageHeader title="Launch funnel" subtitle="Where people are lost between install and paying." />

      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <button
            key={s}
            onClick={() => setSegment(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
              segment === s
                ? "border-pactara-purple bg-pactara-purple text-pactara-purple-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title={`Funnel — ${segment}`}>
          <FunnelView stages={data.funnel} />
        </Panel>

        <div className="space-y-6">
          <Panel title="Biggest funnel leak">
            <InsightCallout tone="bad" title="Largest point of friction">
              {leak.from.label} → {leak.to.label}: {leak.lost.toLocaleString()} users lost,{" "}
              {Math.round(leak.pct * 100)}% drop-off.
            </InsightCallout>
            <p className="mt-4 text-sm font-semibold">Possible things to investigate</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>· Onboarding clarity — is it obvious a group is required?</li>
              <li>· Group creation friction (naming, duration, frequency steps)</li>
              <li>· Invite flow: share sheet, deferred deep link, App Store handoff</li>
              <li>· Whether solo users are given a path to an existing active group</li>
            </ul>
          </Panel>

          <Panel title="Activation">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Signup → Group" value={`${Math.round((group / acct) * 100)}%`} />
              <StatTile label="Group → Commitment" value={`${Math.round((commit / group) * 100)}%`} />
              <StatTile label="Commitment → Check-in" value={`${Math.round((checkin / commit) * 100)}%`} />
              <StatTile
                label="Overall activation"
                value={`${Math.round((checkin / acct) * 100)}%`}
                sub="account → first proof check-in"
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Median time from signup to first successful check-in:{" "}
              <span className="font-bold text-foreground">14 hours</span>
            </p>
            <div className="mt-4">
              <BarList items={data.timeToActivation.map((d) => ({ label: d.label, value: d.value }))} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
