import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdmin } from "@/lib/admin/context";
import { BarList, EmptyNote, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/revenue")({
  head: () => ({
    meta: [
      { title: "Subscriptions · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const { data } = useAdmin();
  const r = data.revenue;

  return (
    <div className="space-y-8">
      <PageHeader title="Subscriptions" subtitle="Who is on a trial, who is paying, and who left." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active subscribers" value={r.activeSubscribers.toLocaleString()} />
        <StatTile label="On trial" value={`${r.trials.toLocaleString()} · ${Math.round(r.trialShare * 100)}%`} />
        <StatTile label="Paying" value={r.paying.toLocaleString()} />
        <StatTile label="Lapsed" value={`${r.churned.toLocaleString()} · ${Math.round(r.churnRate * 100)}%`} />
      </div>

      <Panel title="Subscribers over time" description="Active subscriptions by month.">
        {r.trend.length ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r.trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="subFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="subscribers" name="Subscribers" stroke="#7C3AED" strokeWidth={2} fill="url(#subFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyNote>No subscription history yet.</EmptyNote>
        )}
      </Panel>

      <Panel title="Who subscribes" description="Subscription rate split by how people use Pactara.">
        {r.byBehaviour.length ? (
          <BarList items={r.byBehaviour.map((b) => ({ label: b.label, value: b.conversion }))} />
        ) : (
          <EmptyNote>Not enough subscribers to split this yet.</EmptyNote>
        )}
      </Panel>

      <InsightCallout title="A note on money">
        These are subscription counts from the app's own records, not billed revenue. Exact payouts live in your
        App Store and RevenueCat dashboards.
      </InsightCallout>
    </div>
  );
}
