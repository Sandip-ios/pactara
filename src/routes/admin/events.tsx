import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { buildAnalytics } from "@/lib/admin/analytics-data";
import { PageHeader, Panel } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "Events & data dictionary · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EventsPage,
});

type EventSpec = { name: string; group: string; props: string[]; powers: string };

const COMMON = ["user_id", "anonymous_id", "timestamp", "app_version", "source", "campaign"];

const EVENTS: EventSpec[] = [
  { name: "app_installed", group: "Acquisition", props: ["anonymous_id", "source", "campaign", "app_version"], powers: "Funnel step 1" },
  { name: "account_created", group: "Acquisition", props: [...COMMON], powers: "Funnel, cohorts" },
  { name: "onboarding_started", group: "Onboarding", props: [...COMMON], powers: "Activation" },
  { name: "onboarding_completed", group: "Onboarding", props: [...COMMON], powers: "Activation" },
  { name: "group_created", group: "Groups", props: [...COMMON, "group_id", "challenge_length", "commitment_frequency"], powers: "Funnel, group analytics" },
  { name: "group_joined", group: "Groups", props: [...COMMON, "group_id", "group_size", "source"], powers: "Funnel, partner counts" },
  { name: "group_invite_sent", group: "Growth", props: [...COMMON, "group_id", "group_size"], powers: "Invite rate" },
  { name: "group_invite_opened", group: "Growth", props: ["anonymous_id", "timestamp", "group_id", "source"], powers: "Invite funnel" },
  { name: "group_invite_accepted", group: "Growth", props: [...COMMON, "group_id"], powers: "Invite acceptance" },
  { name: "group_page_viewed", group: "Groups page", props: [...COMMON, "group_id", "active_group_size"], powers: "Groups tab opens" },
  { name: "group_today_viewed", group: "Groups page", props: [...COMMON, "group_id", "challenge_day"], powers: "Today tab views" },
  { name: "group_activity_viewed", group: "Groups page", props: [...COMMON, "group_id"], powers: "Activity tab views" },
  { name: "member_status_viewed", group: "Groups page", props: [...COMMON, "group_id", "active_group_size"], powers: "Status views" },
  { name: "commitment_started", group: "Accountability", props: [...COMMON, "group_id"], powers: "Commit friction" },
  { name: "commitment_created", group: "Accountability", props: [...COMMON, "group_id", "commitment_id", "challenge_day", "current_personal_streak"], powers: "Commitments created" },
  { name: "commitment_missed", group: "Accountability", props: [...COMMON, "group_id", "commitment_id"], powers: "Missed rate" },
  { name: "checkin_started", group: "Accountability", props: [...COMMON, "group_id", "commitment_id"], powers: "Check-in friction" },
  { name: "checkin_completed", group: "Accountability", props: [...COMMON, "group_id", "commitment_id", "current_personal_streak", "current_group_streak"], powers: "North star, completion" },
  { name: "checkin_failed", group: "Accountability", props: [...COMMON, "group_id", "commitment_id"], powers: "Failure alerts by version" },
  { name: "proof_recorded", group: "Accountability", props: [...COMMON, "group_id"], powers: "Proof funnel" },
  { name: "proof_uploaded", group: "Accountability", props: [...COMMON, "group_id"], powers: "Upload reliability" },
  { name: "nudge_viewed", group: "Nudge", props: [...COMMON, "group_id", "active_group_size"], powers: "Nudge rate denominator" },
  { name: "nudge_sent", group: "Nudge", props: [...COMMON, "group_id"], powers: "Nudges sent" },
  { name: "nudge_received", group: "Nudge", props: [...COMMON, "group_id"], powers: "Nudge effectiveness" },
  { name: "nudge_opened", group: "Nudge", props: [...COMMON, "group_id"], powers: "Response time" },
  { name: "reaction_sent", group: "Social", props: [...COMMON, "group_id"], powers: "Social participation" },
  { name: "comment_sent", group: "Social", props: [...COMMON, "group_id"], powers: "Social participation" },
  { name: "group_day_completed", group: "Group outcomes", props: [...COMMON, "group_id", "challenge_day", "active_group_size"], powers: "Group completion rate" },
  { name: "group_streak_started", group: "Group outcomes", props: [...COMMON, "group_id"], powers: "Streak analytics" },
  { name: "group_streak_continued", group: "Group outcomes", props: [...COMMON, "group_id", "current_group_streak"], powers: "Streak analytics" },
  { name: "group_streak_broken", group: "Group outcomes", props: [...COMMON, "group_id", "current_group_streak"], powers: "Lapse analysis" },
  { name: "trial_started", group: "Revenue", props: [...COMMON, "subscription_status"], powers: "Trial rate" },
  { name: "subscription_started", group: "Revenue", props: [...COMMON, "subscription_status"], powers: "Conversion, MRR" },
  { name: "subscription_renewed", group: "Revenue", props: [...COMMON, "subscription_status"], powers: "MRR" },
  { name: "subscription_canceled", group: "Revenue", props: [...COMMON, "subscription_status"], powers: "Churn" },
];

function EventsPage() {
  const [q, setQ] = useState("");
  const filtered = EVENTS.filter(
    (e) => e.name.includes(q.toLowerCase()) || e.group.toLowerCase().includes(q.toLowerCase()),
  );
  const dict = buildAnalytics("30d", true).metrics;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Events & data dictionary"
        subtitle="The event contract that powers every page here, plus the exact metric formulas."
      />

      <Panel
        title="Tracking plan"
        description="Send these from the app with consistent names. Never attach sensitive personal content — no note text, photos or video."
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter events"
            className="rounded-full border border-border/60 px-4 py-1.5 text-sm outline-none focus:border-pactara-purple"
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Area</th>
                <th className="px-3 py-2 text-left">Metadata</th>
                <th className="px-3 py-2 text-left">Powers</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.name} className="border-b border-border/40 align-top">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-pactara-purple-deep">{e.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.group}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(e.props)).map((p) => (
                        <span key={p} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.powers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Metric definitions" description="Same text as every info icon in the dashboard.">
        <div className="grid gap-4 md:grid-cols-2">
          {dict.map((m) => (
            <div key={m.id} className={cn("rounded-2xl border border-border/60 p-4")}>
              <p className="font-bold">{m.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.definition.what}</p>
              <p className="mt-2 rounded-lg bg-pactara-purple-soft px-2 py-1 font-mono text-xs text-pactara-purple-deep">
                {m.definition.formula}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-semibold">Why it matters: </span>
                {m.definition.why}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">How to read it: </span>
                {m.definition.interpret}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
