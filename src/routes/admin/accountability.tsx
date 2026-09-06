import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdmin } from "@/lib/admin/context";
import { BarList, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";

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
  const loopTop = data.dailyLoop[0].users;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Accountability"
        subtitle="Commitments, check-ins, nudges and social participation — the core loop."
      />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Commitments created" value="8,940" />
        <StatTile label="Users making commitments" value="1,206" />
        <StatTile label="Commitments per active user" value="4.6 / week" />
        <StatTile label="Commitment completion rate" value="46%" />
        <StatTile label="Missed commitment rate" value="54%" />
        <StatTile label="Avg commitment → check-in" value="7h 20m" />
        <StatTile label="Proof check-ins completed" value="4,112" />
        <StatTile label="Social participation rate" value="63%" sub="interacted with another member" />
      </div>

      <Panel title="Commitments made vs completed" description="The gap is Pactara's central product problem.">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.commitmentTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="made" name="Made" fill="var(--pactara-purple-soft)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="var(--pactara-purple)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-2 text-sm font-semibold">By day of week</p>
            <BarList
              items={[
                { label: "Mon", value: 0.53 },
                { label: "Wed", value: 0.49 },
                { label: "Fri", value: 0.41 },
                { label: "Sun", value: 0.36 },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">By time committed</p>
            <BarList
              items={[
                { label: "Before 9am", value: 0.61 },
                { label: "9am–noon", value: 0.5 },
                { label: "Noon–6pm", value: 0.39 },
                { label: "After 6pm", value: 0.28 },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">By group size</p>
            <BarList
              items={[
                { label: "2 members", value: 0.34 },
                { label: "3–4 members", value: 0.48 },
                { label: "5–6 members", value: 0.56 },
                { label: "7+ members", value: 0.44 },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">By streak length</p>
            <BarList
              items={[
                { label: "No streak", value: 0.3 },
                { label: "1–3 days", value: 0.47 },
                { label: "4–7 days", value: 0.63 },
                { label: "8+ days", value: 0.78 },
              ]}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Nudges" description="Pactara's most important product experiment.">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Nudges sent" value="1,842" />
          <StatTile label="Users sending" value="604" />
          <StatTile label="Users receiving" value="871" />
          <StatTile label="Nudge rate" value="38%" sub="of members who saw someone waiting" />
          <StatTile label="Nudge response rate" value="77%" />
          <StatTile label="Median nudge → check-in" value="18 min" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold">Check-in rate after a nudge</p>
            <BarList
              items={[
                { label: "Received a nudge", value: 0.68 },
                { label: "No nudge", value: 0.41 },
              ]}
            />
            <InsightCallout tone="good" title="Read this carefully">
              Members who received a nudge were 27 percentage points more likely to complete their commitment
              (68% vs 41%). Nudges are not randomised yet, so treat this as a strong association, not proof of
              cause — nudges also arrive most often in already-engaged groups. Randomise nudge prompts on a
              sample of groups to test causation.
            </InsightCallout>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Response time after a nudge</p>
            <BarList items={data.nudgeResponse.map((n) => ({ label: n.label, value: n.value }))} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Social engagement">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile label="Reactions sent" value="5,204" />
            <StatTile label="Comments sent" value="2,118" />
            <StatTile label="Nudges sent" value="1,842" />
            <StatTile label="Member status views" value="2,760" />
            <StatTile label="Group page views" value="6,060" />
            <StatTile label="Activity feed views" value="4,338" />
          </div>
          <InsightCallout title="Social participation rate">
            63% of active users interacted with at least one other group member this period. If this falls,
            Pactara is drifting toward a solo habit tracker.
          </InsightCallout>
        </Panel>

        <Panel title="Daily accountability loop" description="Where the loop breaks.">
          <ol className="space-y-2">
            {data.dailyLoop.map((s, i) => {
              const prev = i === 0 ? null : data.dailyLoop[i - 1];
              const conv = prev ? s.users / prev.users : 1;
              return (
                <li key={s.label}>
                  {prev && (
                    <p className="ml-4 py-1 text-xs font-semibold text-muted-foreground">
                      ↓ {Math.round(conv * 100)}% continue
                    </p>
                  )}
                  <div className="flex items-center justify-between rounded-2xl bg-pactara-purple-soft/60 px-4 py-3">
                    <span className="text-sm font-bold">{s.label}</span>
                    <span className="text-sm font-bold">
                      {s.users.toLocaleString()}{" "}
                      <span className="font-medium text-muted-foreground">
                        {Math.round((s.users / loopTop) * 100)}%
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
