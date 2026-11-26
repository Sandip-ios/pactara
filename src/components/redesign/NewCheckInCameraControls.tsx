import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGroupsToday } from "@/lib/group-today.functions";
import { showCameraAlreadyIn } from "@/lib/new-checkin-form";
import { getPlanCheckIn } from "@/lib/plan-checkin";
import { getWorkoutCheckIn } from "@/lib/active-workout";

export function NewCheckInCameraControls({ recording, starting, elapsed, switching, onCancel, onFlip, onRecord }: {
  recording: boolean; starting: boolean; elapsed: number; switching: boolean;
  onCancel: () => void; onFlip: () => void; onRecord: () => void;
}) {
  const { data } = useQuery({ queryKey: ["groups-today"], queryFn: () => getGroupsToday(), staleTime: 30_000 });
  const [attachment, setAttachment] = useState<string | null>(null);
  useEffect(() => {
    const plan = getPlanCheckIn();
    const workout = getWorkoutCheckIn();
    if (plan) setAttachment(`${plan.planName} · ${workout?.title ?? `Day ${plan.day}`} added`);
  }, []);
  const alreadyIn = showCameraAlreadyIn((data?.groups ?? []).map((g) => ({ id: g.id, name: g.name, inToday: g.members.find((m) => m.isYou)?.status === "done" })));
  const left = Math.max(0, 5 - Math.floor(elapsed));
  const progress = Math.min(1, elapsed / 5);
  return <>
    <div className="absolute inset-x-0 top-0 pt-[calc(max(env(safe-area-inset-top),54px)+4px)]">
      <div className="flex items-center justify-between gap-2 px-3">
      <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel" className="h-11 w-11 shrink-0 rounded-full bg-[var(--new-camera-control)] text-[var(--new-white)] hover:bg-[var(--new-camera-control)]"><X className="!size-5" /></Button>
      <span className="flex h-9 min-w-0 items-center rounded-full bg-[var(--new-camera-control)] px-3.5 text-[15px] font-bold text-[var(--new-white)]">5-second check-in</span>
      <Button variant="ghost" size="icon" onClick={onFlip} disabled={recording || switching || starting} aria-label="Switch camera" className="h-11 w-11 shrink-0 rounded-full bg-[var(--new-camera-control)] text-[var(--new-white)] hover:bg-[var(--new-camera-control)]"><SwitchCamera className="!size-5" /></Button>
      </div>
      {alreadyIn && !recording && <p className="mx-4 mt-3 rounded-[12px] bg-[var(--new-camera-control)] px-[14px] py-[10px] text-center text-[14px] text-[var(--new-white)]">You're already in today. This check-in won't add to your streak.</p>}
    </div>
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+84px)]">
      {attachment && <span className="flex max-w-full items-center gap-2 rounded-full bg-[var(--new-camera-plan)] px-3.5 py-2 text-[14px] font-bold"><Dumbbell size={17} /><span className="truncate">{attachment}</span></span>}
      <div className="relative flex h-[80px] w-[80px] items-center justify-center">
        <svg className="pointer-events-none absolute inset-0 text-[var(--new-white)]" width="80" height="80" viewBox="0 0 80 80" aria-hidden><circle cx="40" cy="40" r="37.5" stroke="currentColor" strokeWidth="5" fill="none" opacity=".35" />{recording && <circle cx="40" cy="40" r="37.5" stroke="currentColor" strokeWidth="5" fill="none" pathLength="1" strokeDasharray={`${progress} 1`} transform="rotate(-90 40 40)" />}</svg>
        <Button variant="ghost" size="icon" onClick={onRecord} disabled={recording || starting} aria-label={recording ? "Recording" : "Start recording"} className="h-[58px] w-[58px] rounded-full border-0 bg-[var(--new-red)] text-[28px] font-extrabold text-[var(--new-white)] shadow-none disabled:opacity-100 hover:bg-[var(--new-red)] hover:text-[var(--new-white)]">{recording ? left : ""}</Button>
      </div>
      <p className="text-[15px] font-semibold" aria-live="polite">{recording ? `Recording · ${left} seconds left` : starting ? "Starting recording" : "Tap to record 5 seconds"}</p>
    </div>
  </>;
}
