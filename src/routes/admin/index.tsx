import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { useAdmin } from "@/lib/admin/context";
import {
  EmptyNote,
  InfoTip,
  InsightCallout,
  MetricCard,
  PageHeader,
  Panel,
  Sparkline,
  StatTile,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Overview · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OverviewPage,
});

const NORTH_STAR_DEF = {
  what: "People who genuinely used Pactara with someone else this week.",
  formula:
    "Members of a group with at least one other active member who completed a proof check-in on 3 or more days in the last 7",
  why: "It captures Pactara's whole promise at once: a group, a commitment, and proof, repeated.",
  interpret:
    "Growing weekly actives with flat accountable users means you are adding people who never experience the product.",
};

function OverviewPage() {
  const { data, compare } = useAdmin();
  const t = data.today;

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" subtitle="Pactara's real numbers, straight from the app's own database." />

      <Panel title="Pactara yesterday" description="The last full day of the accountability loop.">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { l: "Active people", v: t.activeUsers.toLocaleString() },
            { l: "New accounts", v: t.newAccounts.toLocaleString() },
            { l: "Commitments", v: t.commitments.toLocaleString() },
            { l: "Completed", v: `${t.completed} · ${Math.round(t.completionRate * 100)}%` },
            { l: "Active groups", v: `${t.activeGroups} · ${t.groupsAllIn} all in` },
            { l: "App opens", v: t.opens.toLocaleString() },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-pactara-purple-soft/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.l}</p>
              <p className="mt-1 text-xl font-black tracking-tight">{s.v}</p>
            </div>
          ))}
        </div>
      </Panel>

      <section className="rounded-3xl bg-linear-to-br from-pactara-purple to-pactara-purple-deep p-8 text-pactara-purple-foreground shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] opacity-90">
              Weekly accountable users
              <span className="text-white">
                <InfoTip label="Weekly accountable users" def={NORTH_STAR_DEF} />
              </span>
            </div>
            <p className="mt-2 text-6xl font-black tracking-tight">{data.northStar.value}</p>
            <p className="mt-2 text-base font-semibold opacity-95">
              {Math.round(data.northStar.share * 100)}% of {data.northStar.wau.toLocaleString()} weekly active
              people
              {compare && data.northStar.change !== 0 && (
                <> · {data.northStar.change > 0 ? "↑" : "↓"} {Math.abs(Math.round(data.northStar.change * 100))}% vs previous week</>
              )}
            </p>
          </div>
          <div className="w-full max-w-sm rounded-2xl bg-white/15 p-4">
            <Sparkline data={data.northStar.spark} />
            <p className="mt-2 text-xs opacity-90">Group + commitment + proof, on 3 or more days in the last 7.</p>
          </div>
        </div>
      </section>

      <Panel title="All time" description="Totals since Pactara launched.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Accounts" value={data.totals.accounts.toLocaleString()} />
          <StatTile label="Groups" value={data.totals.groups.toLocaleString()} />
          <StatTile label="Check-ins" value={data.totals.checkIns.toLocaleString()} />
          <StatTile label="Active subscribers" value={data.totals.activeSubscribers.toLocaleString()} />
        </div>
      </Panel>

      {data.alerts.length > 0 && (
        <Panel title="Alerts" description="Only changes that are operationally meaningful.">
          <ul className="space-y-2">
            {data.alerts.map((a) => (
              <li
                key={a.text}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 px-4 py-3"
              >
                {a.severity === "warning" ? (
                  <AlertTriangle className="size-4 text-amber-600" />
                ) : (
                  <Sparkles className="size-4 text-emerald-600" />
                )}
                <span className="text-sm font-medium">{a.text}</span>
                <Link
                  to={a.href as "/admin"}
                  className="ml-auto text-sm font-semibold text-pactara-purple hover:underline"
                >
                  Investigate →
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <section>
        <h2 className="mb-4 text-xl font-black tracking-tight">Product health</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((m) => (
            <MetricCard key={m.id} metric={m} compare={compare} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="What's working">
          {data.working.length === 0 ? (
            <EmptyNote>Nothing stands out as clearly working yet.</EmptyNote>
          ) : (
            <ul className="space-y-3">
              {data.working.map((i) => (
                <li key={i.text} className="flex gap-3 text-sm">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
                  {i.text}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Needs attention">
          {data.attention.length === 0 ? (
            <EmptyNote>Nothing urgent right now.</EmptyNote>
          ) : (
            <ul className="space-y-3">
              {data.attention.map((i) => (
                <li key={i.text} className="flex gap-3 text-sm">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" />
                  {i.text}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="What should I fix first?"
        description="Ranked by how many people it affects and how strongly it links to people staying."
      >
        {data.priorities.length === 0 ? (
          <EmptyNote>No clear priority stands out from the current numbers.</EmptyNote>
        ) : (
          <div className="space-y-4">
            {data.priorities.map((p) => (
              <Link
                key={p.rank}
                to={p.href as "/admin"}
                className="block rounded-2xl border border-border/60 p-5 transition hover:border-pactara-purple/50 hover:bg-pactara-purple-soft/40"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-pactara-purple px-2.5 py-0.5 text-xs font-black text-pactara-purple-foreground">
                    #{p.rank}
                  </span>
                  <h3 className="text-lg font-bold tracking-tight">{p.title}</h3>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    Impact: {p.impact}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Why: </span>
                  {p.why}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Recommended action: </span>
                  {p.action}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-pactara-purple">
                  View supporting data <ArrowRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Engagement right now">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Daily active" value={data.engagement.dailyActive.toLocaleString()} />
          <StatTile label="Weekly active" value={data.engagement.weeklyActive.toLocaleString()} />
          <StatTile label="Monthly active" value={data.engagement.monthlyActive.toLocaleString()} />
          <StatTile
            label="Stickiness"
            value={`${Math.round(data.engagement.stickiness * 100)}%`}
            sub="daily ÷ monthly active"
          />
        </div>
        {!data.engagement.hasOpenData && (
          <InsightCallout title="App opens">
            Open tracking just started. Opens per person will fill in over the next few days.
          </InsightCallout>
        )}
      </Panel>
    </div>
  );
}
