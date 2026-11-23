import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Moon } from "lucide-react";
import { clearCheckInPhoto } from "@/lib/checkin-photo-store";
import { clearCheckInStream } from "@/lib/checkin-stream-store";
import { getRestDayInfo } from "@/lib/rest-days.functions";
import { parseFeedDeepLink } from "@/lib/feed-deeplink";
import { restLeftForGroup } from "@/lib/streak-rules";
import { claimPlanCheckInForLaunch } from "@/lib/plan-checkin";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";

export const MOODS = [
  { id: "crushed", emoji: "🚀", label: "Crushed it", sub: "Absolutely nailed it", color: "#16A34A", bg: "#E8F7EE", ring: "#16A34A" },
  { id: "showed", emoji: "💪", label: "Showed up", sub: "Showed up and did the work", color: PURPLE, bg: "#EFE9FB", ring: PURPLE },
  { id: "struggled", emoji: "😤", label: "Struggled", sub: "Tough day, but still here", color: "#F59E0B", bg: "#FDF1DD", ring: "#F59E0B" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

export const Route = createFileRoute("/_authenticated/check-in/")({
  component: CheckInRouter,
});

// The daily commitment step was removed: tapping check-in always goes straight
// to the camera, unless today is already a rest day.
function CheckInRouter() {
  const fetchRest = useServerFn(getRestDayInfo);
  const { data: rest, isError } = useQuery({
    queryKey: ["rest-day-info"],
    queryFn: () => fetchRest(),
    staleTime: 30_000,
  });
  // The group being checked in to: a reminder's ?group=, else the one last viewed.
  const [groupId, setGroupId] = useState<string | null>(null);
  useEffect(() => {
    const fromLink = parseFeedDeepLink(window.location.search).group;
    setGroupId(fromLink ?? (typeof localStorage !== "undefined" ? localStorage.getItem("active-group-id") : null));
  }, []);
  if (rest?.restingToday) return <RestDayDone remaining={restLeftForGroup(rest.groups, groupId)} />;
  if (!rest && !isError) return <div className="min-h-[100dvh] w-full" style={{ background: BG }} />;
  return <CheckInLaunch />;
}

export function AllGroupsToggle({
  count,
  value,
  onChange,
  label,
}: {
  count: number;
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  if (count < 2) return null;
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-neutral-200 px-4 py-3 text-left"
    >
      <span className="text-[14px] font-medium text-neutral-800">
        {label}
        <span className="block text-[12px] font-normal text-neutral-500">
          Shares with all {count} of your groups
        </span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: value ? PURPLE : "#D9D6D1" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: value ? "1.375rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}

// No separate mood screen: tapping check-in goes straight to the camera.
// The recorder owns camera startup. Requesting a second stream here can race
// with the recorder on iOS and leave both requests waiting indefinitely.
function CheckInLaunch() {
  const navigate = useNavigate();

  useEffect(() => {
    // A reminder or nudge about a specific group opens /check-in?group=<id>,
    // so the check-in posts to that group, not the one last viewed.
    const group = parseFeedDeepLink(window.location.search).group;
    if (group && typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", group);
    }
    // Only a plan workout's Workout done carries a plan day into this check-in.
    claimPlanCheckInForLaunch();
    clearCheckInPhoto();
    clearCheckInStream();
    navigate({ to: "/check-in/camera", replace: true });
  }, [navigate]);

  return <div className="fixed inset-0 w-full" style={{ background: BG }} />;
}

function RestDayDone({ remaining }: { remaining: number }) {
  const navigate = useNavigate();
  return (
    <div
      className="fixed inset-0 w-full flex flex-col items-center justify-center px-8 text-center"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "#EFE9FB" }}>
        <Moon size={28} color={PURPLE} />
      </div>
      <h1 className="mt-5 text-[28px] font-black tracking-tight">Rest day</h1>
      <p className="mt-2 text-[15px] text-neutral-500">
        Recover well. Your streak is safe. {remaining} rest day{remaining === 1 ? "" : "s"} left this week.
      </p>
      <button
        type="button"
        onClick={() => navigate({ to: "/home" })}
        className="mt-8 w-full rounded-2xl py-4 text-white text-[16px] font-semibold"
        style={{ background: PURPLE }}
      >
        Back to home
      </button>
    </div>
  );
}
