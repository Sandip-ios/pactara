import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAdmin } from "./route";
import { BarList, CohortTable, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/retention")({
  head: () => ({
    meta: [
      { title: "Retention · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RetentionPage,
});

function RetentionPage() {
  const { data } = useAdmin();
  const [mode, setMode] = useState<"engagement" | "core">("engagement");
  const rows = mode === "engagement" ? data.cohorts : data.coreCohorts;

  const p0 = data.retentionByPartners[0].d30;
  const p3 = data.retentionByPartners[3].d30;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Retention"
        subtitle="Returning is not enough — retention here means doing something accountable."
      />

      <div className="inline-flex rounded-full bg-muted p-1">
        {(
          [
            ["engagement", "Engagement retention"],
            ["core", "Core retention"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition",
              mode === id
                ? "bg-pactara-purple text-pactara-purple-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        {mode === "engagement"
          ? "Engagement retention: the user returned and did at least one accountability action — commitment, check-in, nudge, comment or reaction."
          : "Core retention: the user completed at least one commitment or check-in."}
      </p>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["D1", 0.54],
          ["D3", 0.43],
          ["D7", 0.34],
          ["D14", 0.26],
          ["D30", 0.19],
          ["Weekly", 0.38],
        ].map(([label, v]) => {
          const value = mode === "engagement" ? (v as number) : (v as number) * 0.72;
          return (
            <StatTile key={label as string} label={`${label} retention`} value={`${Math.round(value * 100)}%`} />
          );
        })}
      </div>

      <Panel title="Cohort retention" description="Rows are signup weeks; darker means stronger retention.">
        <CohortTable rows={rows} columns={["D1", "D3", "D7", "D14", "D30"]} />
      </Panel>

      <Panel
        title="Retention by group activity"
        description="The most important comparison in Pactara: does the social layer change behaviour?"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold">D30 retention by number of active partners</p>
            <BarList
              items={data.retentionByPartners.map((p) => ({
                label: p.label,
                value: p.d30,
                note: `${p.users} users`,
              }))}
            />
          </div>
          <div className="space-y-4">
            <InsightCallout tone="good" title="Insight">
              Users with 3+ active accountability partners retain {Math.round((p3 / p0) * 10) / 10}x better at D30
              than users without an active partner. This is observational — group-joiners may differ from
              non-joiners — but the size of the gap makes getting a second active member the highest-leverage
              onboarding goal.
            </InsightCallout>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="By group size" value="4–6 members retain best" sub="2-person groups fail on absence" />
              <StatTile label="By commitments/week" value="5+ → 2.7x D30" />
              <StatTile label="By nudges received" value="1+ nudge → +14 pts D7" />
              <StatTile label="By group-complete days" value="3+ → 2.1x D30" />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
