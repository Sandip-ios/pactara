import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMemberGoal, setMemberGoal, GOAL_MAX, GOAL_SUGGESTIONS } from "@/lib/member-goal.functions";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import targetImg from "@/assets/goal-target.png";
import { recordAuthenticatedOnboardingStep } from "@/lib/onboarding-analytics.functions";
import { readOnboardingJourney } from "@/lib/onboarding-analytics";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";

export const Route = createFileRoute("/_authenticated/goal/$groupId")({
  component: GoalPage,
  head: () => ({
    meta: [
      { title: "Your goal · Pactara" },
      { name: "description", content: "Set the personal goal you're chasing inside your Pactara group." },
      { property: "og:title", content: "Your goal · Pactara" },
      { property: "og:description", content: "Set the personal goal you're chasing inside your Pactara group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PURPLE = "#7C3AED";
const TEXT_MUTED = "#6B6660";

function GoalPage() {
  // Full-screen page: hide the tabs but keep the light canvas so the status
  // bar area stays white with dark text.
  useHideBottomTabs(true, false);
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useRouterState({ select: (s) => s.location.search }) as { edit?: string };
  const isEdit = String(search?.edit ?? "") === "1";

  const fetchGoal = useServerFn(getMemberGoal);
  const saveGoal = useServerFn(setMemberGoal);
  const recordOnboardingStep = useServerFn(recordAuthenticatedOnboardingStep);
  const { data } = useQuery({
    queryKey: ["member-goal", groupId],
    queryFn: () => fetchGoal({ data: { groupId } }),
  });
  const { data: partnerState } = usePartnerState();
  const displayName = relationForGroup(groupId, partnerState)?.name ?? data?.groupName;

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) return;
    const journey = readOnboardingJourney();
    if (!journey) return;
    void recordOnboardingStep({ data: { ...journey, step: "personal_goal" } }).catch(() => undefined);
  }, [isEdit, recordOnboardingStep]);

  useEffect(() => {
    if (data?.goal) setText((t) => (t ? t : data.goal ?? ""));
  }, [data?.goal]);

  const trimmed = text.trim();
  const canContinue = trimmed.length > 0 && !saving;

  const onContinue = async () => {
    if (!canContinue) return;
    setError(null);
    setSaving(true);
    try {
      await saveGoal({ data: { groupId, goal: trimmed } });
      await queryClient.invalidateQueries({ queryKey: ["member-goal", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      if (isEdit) navigate({ to: "/groups/$groupId", params: { groupId } });
      else navigate({ to: "/pact/$groupId", params: { groupId }, replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your goal");
      setSaving(false);
    }
  };

  return (
    <div
      className="h-[100dvh] w-full flex flex-col px-6 pb-8 overflow-hidden bg-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#0A0A0A", paddingTop: 32 }}
    >
      {isEdit && (
        <div className="flex items-center">
          <button
            onClick={() => navigate({ to: "/groups/$groupId", params: { groupId } })}
            aria-label="Back"
            className="-ml-1 p-1 shrink-0"
          >
            <ChevronLeft size={22} />
          </button>
        </div>
      )}

      <div className="mt-8 flex-1 min-h-0 overflow-y-auto">
        <img
          src={targetImg}
          alt=""
          loading="lazy"
          width={816}
          height={816}
          className="mx-auto h-[104px] w-[104px] object-contain"
        />

        <h1 className="mt-5 text-[30px] font-black leading-[1.1] tracking-tight">What's your goal?</h1>
        <p className="mt-2 text-[15px] leading-snug" style={{ color: TEXT_MUTED }}>
          This is yours — not the group's. {displayName ? `Everyone in ${displayName} sets their own.` : ""}
        </p>

        <div className="mt-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, GOAL_MAX))}
            rows={3}
            placeholder="e.g. Lose 10 pounds and keep it off"
            className="w-full rounded-2xl p-4 text-[16px] leading-snug outline-none resize-none"
            style={{ background: "#F5F3F0", border: `1.5px solid ${text ? PURPLE : "transparent"}` }}
          />
          <div className="mt-1.5 text-right text-[12px]" style={{ color: TEXT_MUTED }}>
            {text.length}/{GOAL_MAX}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {GOAL_SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => setText(s.label)}
              className="rounded-full px-3.5 py-2 text-[14px] font-medium"
              style={{ background: "#F3EEFF", color: "#4C1D95" }}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {trimmed.length > 0 && (
          <div
            className="mt-6 rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "#FBF9FF", border: "1px solid #EADDFF" }}
          >
            <span className="text-[20px] leading-none">🎯</span>
            <div className="min-w-0">
              <div className="text-[12px] font-bold tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
                YOUR GOAL
              </div>
              <div className="mt-1 text-[16px] font-semibold leading-snug break-words">{trimmed}</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-[14px]" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="pt-5">
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full rounded-full py-4 text-white text-[16px] font-semibold transition-opacity disabled:opacity-40"
          style={{ background: PURPLE, boxShadow: `0 10px 30px -12px ${PURPLE}` }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
