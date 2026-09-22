import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdmin } from "@/lib/admin/context";
import { BarList, EmptyNote, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/accountability")({
  head: () => ({
    meta: [
      { title: "Accountability · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountabilityPage,
});

function AccountabilityPage() {
  const { data } = useAdmin();
  const a = data.accountability;

  return (
    <div className="space-y-8">
      <PageHeader title="Accountability" subtitle="Does Pactara actually make people follow through?" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Commitments" value={a.commitments.toLocaleString()} />
        <StatTile label="Completed" value={a.completed.toLocaleString()} />
        <StatTile label="Completion rate" value={`${Math.round(a.completionRate * 100)}%`} />
        <StatTile label="Missed" value={`${Math.round(a.missedRate * 100)}%`} />
      </div>

      <Panel title="Commitments made vs completed" description="Day by day across the selected period.">
        {a.trend.length ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="made" name="Commitments" fill="#DDD6FE" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyNote>No commitments in this period.</EmptyNote>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Completion by group size">
          {a.completionByGroupSize.length ? (
            <BarList items={a.completionByGroupSize} />
          ) : (
            <EmptyNote>Not enough data.</EmptyNote>
          )}
        </Panel>
        <Panel title="Completion by streak length">
          {a.completionByStreak.length ? (
            <BarList items={a.completionByStreak} />
          ) : (
            <EmptyNote>Not enough data.</EmptyNote>
          )}
        </Panel>
        <Panel title="Completion by weekday">
          {a.completionByWeekday.length ? (
            <BarList items={a.completionByWeekday} />
          ) : (
            <EmptyNote>Not enough data.</EmptyNote>
          )}
        </Panel>
      </div>

      <Panel title="Per person">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile label="People committing" value={a.usersCommitting.toLocaleString()} />
          <StatTile label="Commitments per person" value={a.perActiveUser.toFixed(1)} />
        </div>
      </Panel>

      <InsightCallout title="How to read this">
        A high commitment count with low completion means people understand the idea but the follow-through
        moment is too hard. Look at reminder timing and how long a check-in takes.
      </InsightCallout>
    </div>
  );
}
