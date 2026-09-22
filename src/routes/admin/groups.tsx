import { createFileRoute } from "@tanstack/react-router";
import { useAdmin } from "@/lib/admin/context";
import { BarList, EmptyNote, PageHeader, Panel, StatTile } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/groups")({
  head: () => ({
    meta: [
      { title: "Groups · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GroupsPage,
});

const TONE: Record<string, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-rose-600",
};

function GroupsPage() {
  const { data } = useAdmin();
  const g = data.groups;

  return (
    <div className="space-y-8">
      <PageHeader title="Groups" subtitle="Whether the social layer is actually alive." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Groups" value={data.totals.groups.toLocaleString()} />
        <StatTile label="Active group rate" value={`${Math.round(g.activeGroupRate * 100)}%`} sub="2+ members, active in period" />
        <StatTile label="Whole-group days" value={`${Math.round(g.groupCompletionRate * 100)}%`} sub="everyone checked in" />
        <StatTile label="Average group size" value={data.growth.avgGroupSize.toFixed(1)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Group health" description="How many groups fall into each state.">
          {g.health.length ? (
            <ul className="space-y-3">
              {g.health.map((h) => (
                <li key={h.label} className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
                  <span className="text-sm font-medium">{h.label}</span>
                  <span className={cn("text-lg font-black", TONE[h.tone])}>{h.groups}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>No groups yet.</EmptyNote>
          )}
        </Panel>

        <Panel title="Solo vs social">
          <BarList
            items={[
              { label: "One-person groups", value: data.growth.soloGroupShare },
              { label: "Groups with partners", value: 1 - data.growth.soloGroupShare },
            ]}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            One-person groups mean people are using Pactara as a solo tracker, which is where retention is weakest.
          </p>
        </Panel>
      </div>

      <Panel title="Every group" description="Live status of each group.">
        {g.list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 text-left">Group</th>
                  <th className="py-2 text-right">Members</th>
                  <th className="py-2 text-right">Active</th>
                  <th className="py-2 text-right">Day</th>
                  <th className="py-2 text-right">Pact signed</th>
                  <th className="py-2 text-right">Completion</th>
                </tr>
              </thead>
              <tbody>
                {g.list.map((row) => (
                  <tr key={row.id} className="border-t border-border/50">
                    <td className="py-2.5 font-semibold">{row.name}</td>
                    <td className="py-2.5 text-right">{row.size}</td>
                    <td className="py-2.5 text-right">{row.active}</td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {row.day} / {row.length}
                    </td>
                    <td className="py-2.5 text-right">
                      {row.signed} / {row.size}
                    </td>
                    <td className="py-2.5 text-right font-bold">{Math.round(row.completion * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyNote>No groups yet.</EmptyNote>
        )}
      </Panel>
    </div>
  );
}
