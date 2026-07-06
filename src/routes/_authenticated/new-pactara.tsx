import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Share2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfileOverview } from "@/lib/profile.functions";
import {
  GOALS,
  ICON_FOR_GOAL,
  PURPLE,
  PrimaryButton,
  GoalStep,
  CompanyStep,
  GroupStep,
  CommitmentStep,
  InviteStep,
  NotifyStep,
  GreetingStep,
  HowItWorksStep,
} from "@/routes/signup";
import { createGroupForUser } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/new-pactara")({
  component: NewPactaraFlow,
});

const TRACK = "#EAE4F5";
const TEXT_MUTED = "#6B6660";
const TEXT = "#0A0A0A";

type StepKey =
  | "goal"
  | "company"
  | "group"
  | "commitment"
  | "invite"
  | "notify"
  | "greeting"
  | "how";

const STEPS: StepKey[] = [
  "goal",
  "company",
  "group",
  "commitment",
  "invite",
  "notify",
  "greeting",
  "how",
];

function NewPactaraFlow() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getProfile = useServerFn(getProfileOverview);
  const { data: profile } = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => getProfile(),
    staleTime: 60_000,
  });
  const firstName = (profile?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const [stepIdx, setStepIdx] = useState(0);

  const [goal, setGoal] = useState<string | null>(null);
  const [customGoalLabel, setCustomGoalLabel] = useState("");
  const [groupName, setGroupName] = useState("");
  const [duration, setDuration] = useState<30 | 60 | 90 | "custom">(30);
  const [customDays, setCustomDays] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [daysPerWeek, setDaysPerWeek] = useState(3);

  const step = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  const goalLabel = useMemo(() => {
    if (goal === "custom") return customGoalLabel.trim() || "your goal";
    return GOALS.find((g) => g.id === goal)?.label ?? "your goal";
  }, [goal, customGoalLabel]);
  const goalEmoji = goal ? ICON_FOR_GOAL[goal] : "🎯";

  const ensureGroupName = () => {
    if (!groupName && goal) {
      const label = goal === "custom" ? (customGoalLabel.trim() || "My") : GOALS.find((x) => x.id === goal)!.label;
      setGroupName(`${label} Crew`);
    }
  };

  const ensureGroupName = () => {
    if (!groupName && goal) {
      const g = GOALS.find((x) => x.id === goal)!;
      setGroupName(`${g.label} Crew`);
    }
  };

  const next = () => {
    if (step === "goal") ensureGroupName();
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const back = () => {
    if (stepIdx === 0) navigate({ to: "/groups" });
    else setStepIdx((i) => i - 1);
  };

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const finish = async () => {
    if (finishing) return;
    setFinishError(null);
    setFinishing(true);
    try {
      const finalGroupName = groupName.trim() || `${goalLabel} Crew`;
      await createGroupForUser({ data: { name: finalGroupName, emoji: goalEmoji } });
      await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      navigate({ to: "/groups" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setFinishError(msg);
      setFinishing(false);
    }
  };

  const canContinue = (() => {
    switch (step) {
      case "goal":
        return goal !== null;
      case "group":
        return groupName.trim().length > 0;
      case "commitment":
        return duration !== "custom" || customDays.trim().length > 0;
      default:
        return true;
    }
  })();

  if (step === "company") return <CompanyStep onContinue={next} onBack={back} />;
  if (step === "greeting") {
    const days =
      goal === "75-hard"
        ? 75
        : duration === "custom"
          ? parseInt(customDays, 10) || 30
          : duration;
    return <GreetingStep firstName={firstName} days={days} onContinue={next} onBack={back} />;
  }
  if (step === "how") {
    return (
      <>
        <HowItWorksStep onDone={finish} onBack={back} />
        {finishing && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl px-6 py-5 text-[15px] font-medium">
              Creating your group…
            </div>
          </div>
        )}
        {finishError && (
          <div
            className="fixed bottom-6 inset-x-6 z-50 rounded-xl bg-red-600 text-white px-4 py-3 text-[14px]"
            role="alert"
          >
            {finishError}
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="h-[100dvh] w-full flex flex-col px-6 pb-8 overflow-hidden"
      style={{
        background: "#FFFFFF",
        fontFamily: "Inter, system-ui, sans-serif",
        color: TEXT,
        paddingTop: 32,
      }}
    >
      <div className="flex items-center gap-3">
        <button onClick={back} aria-label="Back" className="-ml-1 p-1 shrink-0">
          <ChevronLeft size={22} />
        </button>
        <div
          className="flex-1 h-[5px] rounded-full overflow-hidden"
          style={{ background: TRACK }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: PURPLE }}
          />
        </div>
      </div>

      <div className="mt-10 flex-1 flex flex-col min-h-0 overflow-y-auto">
        {step === "goal" && <GoalStep goal={goal} setGoal={setGoal} />}
        {step === "group" && (
          <GroupStep
            groupName={groupName}
            setGroupName={setGroupName}
            firstName={firstName}
            goalLabel={goalLabel}
            goalEmoji={goalEmoji}
          />
        )}
        {step === "commitment" && (
          <CommitmentStep
            goalLabel={goalLabel.toLowerCase()}
            goalId={goal}
            duration={duration}
            setDuration={setDuration}
            customDays={customDays}
            setCustomDays={setCustomDays}
            frequency={frequency}
            setFrequency={setFrequency}
            daysPerWeek={daysPerWeek}
            setDaysPerWeek={setDaysPerWeek}
          />
        )}
        {step === "invite" && <InviteStep />}
        {step === "notify" && <NotifyStep onAllow={next} />}
      </div>

      <div className="flex flex-col items-center gap-3 pt-6">
        {step === "invite" ? (
          <>
            <PrimaryButton onClick={next} label="Invite your people" icon={<Share2 size={18} />} />
            <div className="flex flex-col items-center gap-2 mt-auto pt-24 pb-2">
              <button
                onClick={next}
                className="text-[15px] font-medium underline"
                style={{ color: TEXT_MUTED }}
              >
                Skip for now
              </button>
              <p className="text-[13px] text-center" style={{ color: "#8A8580" }}>
                You can invite people later from inside the app.
              </p>
            </div>
          </>
        ) : step === "notify" ? null : (
          <PrimaryButton disabled={!canContinue} onClick={next} label="Continue" withArrow />
        )}
      </div>
    </div>
  );
}
