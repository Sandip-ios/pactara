import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdmin } from "@/lib/admin/context";
import { BarList, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const { data } = useAdmin();
  const mrr = data.mrrTrend[data.mrrTrend.length - 1].mrr;

  return (
    <div className="space-y-8">
      <PageHeader title="Revenue" subtitle="Which behaviours predict willingness to pay." />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Trials started" value="418" />
        <StatTile label="Trial start rate" value="24%" sub="of activated users" />
        <StatTile label="Trial → paid conversion" value="31%" />
        <StatTile label="Active subscribers" value="512" />
        <StatTile label="New subscribers" value="128" />
        <StatTile label="Canceled subscribers" value="34" />
        <StatTile label="Subscription churn" value="6.2% / mo" />
        <StatTile label="MRR" value={`$${mrr.toLocaleString()}`} />
        <StatTile label="ARR" value={`$${(mrr * 12).toLocaleString()}`} />
        <StatTile label="ARPU" value="$10.40" />
      </div>

      <Panel title="MRR trend">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.mrrTrend}>
              <defs>
                <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--pactara-purple)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--pactara-purple)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="mrr"
                stroke="var(--pactara-purple)"
                strokeWidth={3}
                fill="url(#mrrFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Paid conversion by behaviour" description="Trial → paid conversion, segmented.">
        <BarList items={data.revenueBySegment.map((s) => ({ label: s.label, value: s.conversion }))} />
        <InsightCallout tone="good" title="What predicts paying">
          Retention and active groups predict payment far better than acquisition source. D7-retained users
          convert at 34% versus 3% for everyone else, and members of active groups convert 4.3x better than
          members of inactive ones. Spending on getting people into an active group pays back through revenue,
          not just engagement.
        </InsightCallout>
      </Panel>
    </div>
  );
}
