import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdmin } from "@/lib/admin/context";
import { BarList, EmptyNote, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/growth")({
  head: () => ({
    meta: [
      { title: "Growth · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GrowthPage,
});

function GrowthPage() {
  const { data } = useAdmin();
  const g = data.growth;

  return (
    <div className="space-y-8">
      <PageHeader title="Growth" subtitle="How new people arrive and how many friends they bring." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="New accounts" value={data.acquisition.signupsTotal.toLocaleString()} />
        <StatTile label="Group creators" value={g.creators.toLocaleString()} />
        <StatTile label="Partners per creator" value={g.avgPartnersPerCreator.toFixed(1)} />
        <StatTile label="Joined someone else's group" value={g.joinedNotCreated.toLocaleString()} />
      </div>

      <Panel title="New accounts over time">
        {data.acquisition.signups.length ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.acquisition.signups} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="value" name="New accounts" stroke="#7C3AED" strokeWidth={2} fill="url(#signupFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyNote>No signups in this period.</EmptyNote>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Invite journey" description="From creating a group to having real partners in it.">
          {g.inviteFunnel.length ? (
            <BarList items={g.inviteFunnel} />
          ) : (
            <EmptyNote>No groups created in this period.</EmptyNote>
          )}
        </Panel>

        <Panel title="How often people open Pactara">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              label="Opens per active person / day"
              value={data.engagement.hasOpenData ? data.engagement.opensPerActiveUser.toFixed(1) : "—"}
            />
            <StatTile label="Stickiness" value={`${Math.round(data.engagement.stickiness * 100)}%`} sub="daily ÷ monthly" />
          </div>
          {data.engagement.hasOpenData ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">Busiest hours</p>
              <BarList
                items={data.engagement.hourly.map((h) => ({ label: h.hour, value: h.opens }))}
                format="number"
              />
            </div>
          ) : (
            <div className="mt-5">
              <InsightCallout title="Just started counting">
                Open tracking begins from today, so this fills in over the next few days.
              </InsightCallout>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
