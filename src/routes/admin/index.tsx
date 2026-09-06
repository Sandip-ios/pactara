import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { useAdmin } from "@/lib/admin/context";
import {
  InfoTip,
  InsightCallout,
  MetricCard,
  PageHeader,
  Panel,
  Sparkline,
  fmt,
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
  what: "Users who genuinely used Pactara with other people this week.",
  formula:
    "Users in a group with 1+ other active member who created a commitment and completed a proof check-in on 3+ distinct days in a rolling 7-day window",
  why: "It is the only number that captures Pactara's whole promise at once: a group, a commitment, and proof, repeated.",
  interpret:
    "Growing WAU with flat Accountable Users means you are adding people who are not experiencing the product.",
};

function OverviewPage() {
  const { data, compare } = useAdmin();
  const t = data.today;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle="Everything you need to judge Pactara's health in about 30 seconds."
      />

      {/* Pactara Today */}
      <Panel title="Pactara today" description="Yesterday's accountability loop, at a glance.">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { l: "Active users", v: t.activeUsers.toLocaleString() },
            { l: "Commitments", v: t.commitments.toLocaleString() },
            { l: "Completed", v: `${t.completed} · ${Math.round(t.completionRate * 100)}%` },
            { l: "Active groups", v: `${t.activeGroups} · ${t.groupsAllIn} all in` },
            { l: "Nudges sent", v: `${t.nudges} · ${Math.round(t.nudgeFollowThrough * 100)}% followed through` },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-pactara-purple-soft/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.l}</p>
              <p className="mt-1 text-xl font-black tracking-tight">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InsightCallout tone="good" title="Biggest win">
            {t.win}
          </InsightCallout>
          <InsightCallout tone="bad" title="Biggest concern">
            {t.concern}
          </InsightCallout>
          <InsightCallout title="Today's focus">{t.focus}</InsightCallout>
        </div>
      </Panel>

      {/* North star */}
      <section className="rounded-3xl bg-linear-to-br from-pactara-purple to-pactara-purple-deep p-8 text-pactara-purple-foreground shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] opacity-90">
              Weekly Accountable Users
              <span className="text-white">
                <InfoTip label="Weekly Accountable Users" def={NORTH_STAR_DEF} />
              </span>
            </div>
            <p className="mt-2 text-6xl font-black tracking-tight">{data.northStar.value}</p>
            <p className="mt-2 text-base font-semibold opacity-95">
              {Math.round(data.northStar.share * 100)}% of {data.northStar.wau.toLocaleString()} weekly active users
              {compare && <> · ↑ {Math.round(data.northStar.change * 100)}% vs previous week</>}
            </p>
          </div>
          <div className="w-full max-w-sm rounded-2xl bg-white/15 p-4">
            <Sparkline data={data.northStar.spark} />
            <p className="mt-2 text-xs opacity-90">
              Group + commitment + proof, on 3 or more days in a rolling 7-day window.
            </p>
          </div>
        </div>
      </section>

      {/* Alerts */}
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

      {/* Product health */}
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
          <ul className="space-y-3">
            {data.working.map((i) => (
              <li key={i.text} className="flex gap-3 text-sm">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
                {i.text}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Needs attention">
          <ul className="space-y-3">
            {data.attention.map((i) => (
              <li key={i.text} className="flex gap-3 text-sm">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" />
                {i.text}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <PriorityPanel />

      <Panel
        title="What the data is telling you"
        description="Plain-language reading of the current numbers."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {readouts(data).map((r) => (
            <div key={r.title} className="rounded-2xl border border-border/60 p-4">
              <p className="text-sm font-bold">{r.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function PriorityPanel() {
  const { data } = useAdmin();
  return (
    <Panel
      title="What should I fix first?"
      description="Ranked by affected population, severity of drop-off, link to retention, and change vs the previous period."
    >
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
    </Panel>
  );
}

function readouts(data: ReturnType<typeof useAdmin>["data"]) {
  const m = Object.fromEntries(data.metrics.map((x) => [x.id, x.value]));
  const out: { title: string; body: string }[] = [];
  if (m.activation < 0.5)
    out.push({
      title: `Activation is ${fmt(m.activation, "percent")}`,
      body: "Users are not reaching Pactara's core experience. Investigate onboarding, group creation and the first commitment.",
    });
  out.push({
    title: "Invite acceptance is falling",
    body: "Users are creating groups but their friends aren't joining. Improve the invite experience before spending heavily on acquisition.",
  });
  out.push({
    title: "High commitment, low completion",
    body: "Users understand the intention-setting behaviour but are not following through. Investigate reminder timing, proof friction and accountability features.",
  });
  if (m.nudge > 0.6)
    out.push({
      title: `Nudging associates with ${fmt(m.nudge, "percent")} follow-through`,
      body: "Social intervention appears to be working. Make nudging more visible and encourage members to use it — then randomise it to test causation.",
    });
  if (m.d1 > 0.45 && m.d7 < 0.35)
    out.push({
      title: "D1 healthy, D7 softer",
      body: "Users understand Pactara initially, but the experience is not yet becoming a habit.",
    });
  if (m.d7 > 0.3 && m.d30 < 0.25)
    out.push({
      title: "D7 strong, D30 weak",
      body: "Initial accountability works but loses momentum. Investigate the group streak lifecycle and long-term challenge engagement.",
    });
  return out;
}
