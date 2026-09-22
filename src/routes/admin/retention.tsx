import { createFileRoute } from "@tanstack/react-router";
import { useAdmin } from "@/lib/admin/context";
import {
  BarList,
  CohortTable,
  EmptyNote,
  InsightCallout,
  PageHeader,
  Panel,
  StatTile,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/retention")({
  head: () => ({
    meta: [
      { title: "Retention · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RetentionPage,
});

const COLUMNS = ["D1", "D3", "D7", "D14", "D30"];

function RetentionPage() {
  const { data } = useAdmin();

  return (
    <div className="space-y-8">
      <PageHeader title="Retention" subtitle="Who comes back, and for how long." />

      <Panel title="Coming back" description="Two definitions, side by side.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 text-left">Day</th>
                <th className="py-2 text-left">Opened the app</th>
                <th className="py-2 text-left">Actually checked in</th>
              </tr>
            </thead>
            <tbody>
              {data.retentionSummary.map((r) => (
                <tr key={r.label} className="border-t border-border/50">
                  <td className="py-2.5 font-semibold">{r.label}</td>
                  <td className="py-2.5">{Math.round(r.engagement * 100)}%</td>
                  <td className="py-2.5 font-bold text-pactara-purple">{Math.round(r.core * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          The second column is the honest one. It only counts people who completed a proof check-in.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Retention by signup week" description="Any activity in the app.">
          {data.cohorts.length ? (
            <CohortTable rows={data.cohorts} columns={COLUMNS} />
          ) : (
            <EmptyNote>Not enough signup history yet.</EmptyNote>
          )}
        </Panel>
        <Panel title="Check-in retention by signup week" description="Proof check-ins only.">
          {data.coreCohorts.length ? (
            <CohortTable rows={data.coreCohorts} columns={COLUMNS} />
          ) : (
            <EmptyNote>Not enough signup history yet.</EmptyNote>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Does having partners help?" description="Retention split by how many people are in the group.">
          {data.retentionByPartners.length ? (
            <BarList
              items={data.retentionByPartners.map((r) => ({
                label: r.label,
                value: r.d30,
                note: `${r.users} people · D7 ${Math.round(r.d7 * 100)}%`,
              }))}
            />
          ) : (
            <EmptyNote>Not enough people to split this yet.</EmptyNote>
          )}
        </Panel>

        <Panel title="How long people stay">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile label="Average active days" value={`${data.lifetime.avgActiveDays}`} />
            <StatTile label="Median active days" value={`${data.lifetime.medianActiveDays}`} />
          </div>
          <p className="mt-5 mb-2 text-sm font-semibold">Groups still going</p>
          {data.lifetime.groupSurvival.length ? (
            <BarList items={data.lifetime.groupSurvival} />
          ) : (
            <EmptyNote>No groups old enough to measure.</EmptyNote>
          )}
        </Panel>
      </div>

      <InsightCallout title="How to read this">
        A strong first week with a weak fourth week means the first challenge ends badly. A weak first week means
        people never understood what to do.
      </InsightCallout>
    </div>
  );
}
