import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { BarList, InsightCallout, PageHeader, Panel, StatTile } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/growth")({
  head: () => ({
    meta: [
      { title: "Growth · Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GrowthPage,
});

const LOOP = [
  "User creates a group",
  "Invites friends",
  "Friends join",
  "Friends create groups",
  "Friends invite others",
];

function GrowthPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Growth" subtitle="Invites are Pactara's growth engine — and its weakest link." />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Invites sent" value="2,431" />
        <StatTile label="Unique inviters" value="642" />
        <StatTile
          label="Invite acceptance rate"
          value="48%"
          sub="down from 63%"
          def={{
            what: "Share of valid invites that resulted in a joined group.",
            formula: "Accepted invites ÷ valid invites sent",
            why: "Every accepted invite adds an active partner, the strongest retention driver in the product.",
            interpret: "A drop here caps growth and retention at the same time — investigate before spending on ads.",
          }}
        />
        <StatTile label="Invites per active user" value="2.0" />
        <StatTile label="New users from invitations" value="1,167" />
        <StatTile label="Groups created through invitations" value="212" />
        <StatTile label="Avg invitations per new group" value="3.4" />
        <StatTile label="New activated users per activated user" value="0.72" sub="viral factor" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Where invites break">
          <BarList
            items={[
              { label: "Invite sent", value: 2431, note: "100%" },
              { label: "Invite link opened", value: 1604, note: "66%" },
              { label: "App installed / opened", value: 1289, note: "53%" },
              { label: "Joined the group", value: 1167, note: "48%" },
            ]}
            format="number"
          />
          <InsightCallout tone="bad" title="Biggest growth leak">
            34% of invites are never opened, and another 13% stall between opening the link and joining. The
            App Store handoff and the invited-user onboarding are the two places to look first.
          </InsightCallout>
        </Panel>

        <Panel title="Viral loop">
          <ol className="space-y-2">
            {LOOP.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-pactara-purple text-xs font-black text-pactara-purple-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 rounded-2xl bg-pactara-purple-soft/60 px-4 py-2.5 text-sm font-semibold">
                  {step}
                </span>
                {i < LOOP.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
              </li>
            ))}
          </ol>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatTile label="Invites per activated user" value="3.8" />
            <StatTile label="Activated users generated" value="0.72 each" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            A viral factor below 1.0 means invites slow your acquisition cost but do not grow the app on their
            own. Lifting acceptance from 48% back to 63% would push this to roughly 0.95.
          </p>
        </Panel>
      </div>
    </div>
  );
}
