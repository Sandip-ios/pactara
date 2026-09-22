import { createFileRoute } from "@tanstack/react-router";
import { useAdmin } from "@/lib/admin/context";
import { PageHeader, Panel, StatTile } from "@/components/admin/kit";
import { METRIC_DEFS } from "@/lib/admin/analytics-data";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "Data sources · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EventsPage,
});

const SOURCES = [
  {
    name: "Accounts",
    what: "Every person who finished creating an account.",
    used: "New accounts, activation, retention, funnel.",
  },
  {
    name: "Group memberships",
    what: "Who is in which group, when they joined, their personal goal and pact signature.",
    used: "Funnel, group health, invites, partners per creator.",
  },
  {
    name: "Check-ins",
    what: "Completed proof check-ins.",
    used: "Activation, completion rate, streaks, accountable users.",
  },
  {
    name: "Daily posts",
    what: "One row per person per day: the commitment and whether it was missed.",
    used: "Commitments made vs completed, missed rate.",
  },
  {
    name: "App opens",
    what: "Recorded when someone opens Pactara while signed in. Started the day this dashboard shipped.",
    used: "Opens per person, busiest hours, stickiness.",
  },
  {
    name: "Subscriptions",
    what: "Trial and paid status kept in sync from the store.",
    used: "Subscribers, trials, lapsed.",
  },
  {
    name: "App Store downloads",
    what: "Daily units from App Store Connect, cached once connected.",
    used: "Downloads and download-to-account rate.",
  },
];

function EventsPage() {
  const { data } = useAdmin();

  return (
    <div className="space-y-8">
      <PageHeader title="Data sources" subtitle="Exactly where every number on this dashboard comes from." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Accounts" value={data.totals.accounts.toLocaleString()} />
        <StatTile label="Groups" value={data.totals.groups.toLocaleString()} />
        <StatTile label="Check-ins" value={data.totals.checkIns.toLocaleString()} />
        <StatTile
          label="Open tracking"
          value={data.engagement.hasOpenData ? "Collecting" : "Just started"}
        />
      </div>

      <Panel title="Sources">
        <ul className="space-y-3">
          {SOURCES.map((s) => (
            <li key={s.name} className="rounded-2xl border border-border/60 p-4">
              <p className="text-sm font-bold">{s.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.what}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-pactara-purple">
                Used for: {s.used}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="How each headline number is calculated">
        <dl className="grid gap-4 md:grid-cols-2">
          {Object.entries(METRIC_DEFS).map(([id, def]) => (
            <div key={id} className="rounded-2xl border border-border/60 p-4">
              <dt className="text-sm font-bold capitalize">{id.replace(/([A-Z])/g, " $1")}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{def.what}</dd>
              <dd className="mt-2 rounded-lg bg-pactara-purple-soft px-2 py-1 font-mono text-xs text-pactara-purple-deep">
                {def.formula}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
