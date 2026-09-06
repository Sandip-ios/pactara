import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdmin } from "./route";
import { BarList, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";
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

const ACTIVE_GROUP_DEF = {
  what: "A group where at least two members performed an accountability action during the selected period.",
  formula: "Active groups ÷ total eligible groups",
  why: "Pactara's value depends on active social accountability rather than solo usage.",
  interpret: "Below 50% means a large share of users are effectively using a solo habit tracker.",
};

function GroupsPage() {
  const { data } = useAdmin();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const totalGroups = 152;
  const trend = data.commitmentTrend.map((d, i) => ({
    day: d.day,
    rate: Math.round((0.34 + (i / data.commitmentTrend.length) * 0.12) * 100),
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Groups" subtitle="Whether the social container is actually alive." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total groups" value={String(totalGroups)} />
        <StatTile label="New groups" value="34" sub="this period" />
        <StatTile label="Active groups" value="89" />
        <StatTile label="Inactive groups" value="63" />
        <StatTile label="Average group size" value="4.3" />
        <StatTile label="Median group size" value="4" />
        <StatTile label="Avg active members / group" value="2.6" />
        <StatTile
          label="Active group rate"
          value="58%"
          sub="2+ members took an action"
          def={ACTIVE_GROUP_DEF}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Group health distribution">
          <BarList
            items={data.groupHealth.map((g) => ({ label: g.label, value: g.groups }))}
            format="number"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="Groups with 2+ active" value="72%" />
            <StatTile label="Groups with 3+ active" value="41%" />
          </div>
        </Panel>

        <Panel title="Group completion rate" description="Group-days where every required member finished.">
          <p className="text-5xl font-black tracking-tight">42%</p>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--pactara-purple)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile label="Avg group streak" value="5.2 days" />
            <StatTile label="Median group streak" value="3 days" />
            <StatTile label="Longest current" value="27 days" />
          </div>
          <div className="mt-4">
            <BarList
              items={[
                { label: "Reached 3 days", value: 0.64 },
                { label: "Reached 7 days", value: 0.38 },
                { label: "Reached 14 days", value: 0.21 },
                { label: "Reached 30 days", value: 0.09 },
              ]}
            />
          </div>
          <InsightCallout tone="good" title="Streaks and retention">
            Groups that reach a 7-day group streak have 2.3x higher D30 retention than groups that never do.
            Helping a group over its first week looks more valuable than any individual reminder change.
          </InsightCallout>
        </Panel>
      </div>

      <Panel
        title="Groups page engagement"
        description="Does the Groups tab pull people back to check 'who has shown up?'"
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Groups tab opens" value="6,060" />
          <StatTile label="Group detail opens" value="3,412" />
          <StatTile label="Today tab views" value="3,180" />
          <StatTile label="Activity tab views" value="1,044" />
          <StatTile label="Member status views" value="2,760" />
          <StatTile label="Nudge button views" value="1,930" />
          <StatTile label="Nudge button clicks" value="418" sub="22% of views" />
          <StatTile label="Groups opens per DAU" value="3.1" />
        </div>
        <div className="mt-6 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="opens" fill="var(--pactara-purple)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.groupsByHour.map((g) => (
            <StatTile key={g.part} label={g.part} value={g.opens.toLocaleString()} />
          ))}
        </div>
      </Panel>

      <Panel title="Group explorer" description="Activity metadata only — no check-in media or personal content.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border/60">
                {["Group", "Size", "Active", "Day", "Group streak", "Completion", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.groupList.map((g) => (
                <>
                  <tr key={g.id} className="border-b border-border/40">
                    <td className="px-3 py-3 font-semibold">{g.name}</td>
                    <td className="px-3 py-3">{g.size}</td>
                    <td className="px-3 py-3">{g.active}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {g.day} of {g.length}
                    </td>
                    <td className="px-3 py-3">🔥 {g.streak}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-bold",
                          g.completion > 0.6
                            ? "bg-emerald-50 text-emerald-700"
                            : g.completion > 0.35
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700",
                        )}
                      >
                        {Math.round(g.completion * 100)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)}
                        className="text-sm font-semibold text-pactara-purple hover:underline"
                      >
                        {openGroup === g.id ? "Hide" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                  {openGroup === g.id && (
                    <tr key={`${g.id}-detail`}>
                      <td colSpan={7} className="bg-pactara-purple-soft/40 px-3 py-4">
                        <div className="grid gap-3 sm:grid-cols-4">
                          <StatTile label="Commitments this period" value={String(g.active * 11)} />
                          <StatTile label="Check-ins" value={String(Math.round(g.active * 11 * g.completion))} />
                          <StatTile label="Nudges sent" value={String(g.active * 3)} />
                          <StatTile label="Group-complete days" value={String(g.streak)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
