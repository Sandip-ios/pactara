import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Dumbbell, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewSheet, NewSheetRow, NewSheetCheckbox, NewSheetButton, NewSheetAvatars } from "./NewSheet";
import { getGroupsToday } from "@/lib/group-today.functions";
import { crewPageCounts } from "@/lib/group-today-view";
import { eligibleCrewIds, readNewCheckIn, writeNewCheckIn } from "@/lib/redesign-checkin";
import { getPlanCheckIn } from "@/lib/plan-checkin";
import { getWorkoutCheckIn } from "@/lib/active-workout";

export function NewCheckInCameraControls({ recording, starting, elapsed, switching, onCancel, onFlip, onRecord }: {
  recording: boolean; starting: boolean; elapsed: number; switching: boolean;
  onCancel: () => void; onFlip: () => void; onRecord: () => void;
}) {
  const { data } = useQuery({ queryKey: ["groups-today"], queryFn: () => getGroupsToday(), staleTime: 30_000 });
  const [selected, setSelected] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const session = readNewCheckIn();
    const eligible = eligibleCrewIds(data.groups);
    const ids = session?.groupIds.length ? session.groupIds.filter((id) => eligible.includes(id)) : eligible;
    setSelected(ids);
    writeNewCheckIn({ groupIds: ids, returnCrewId: session?.returnCrewId ?? null });
  }, [data]);
  useEffect(() => {
    const plan = getPlanCheckIn();
    const workout = getWorkoutCheckIn();
    if (plan) setAttachment(`${plan.planName} · ${workout?.title ?? `Day ${plan.day}`} added`);
  }, []);
  const groups = data?.groups ?? [];
  const picked = groups.filter((g) => selected.includes(g.id));
  const label = picked.length > 1 ? `${picked.length} crews` : picked[0]?.name ?? "your crew";
  const left = Math.max(0, 5 - Math.floor(elapsed));
  const progress = Math.min(1, elapsed / 5);
  const toggle = (id: string) => {
    const ids = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
    setSelected(ids);
    writeNewCheckIn({ groupIds: ids, returnCrewId: readNewCheckIn()?.returnCrewId ?? null });
  };
  const record = () => {
    const crewId = selected[0];
    if (!crewId) return;
    try { localStorage.setItem("active-group-id", crewId); } catch { /* private mode */ }
    onRecord();
  };
  return <>
    <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-[calc(max(env(safe-area-inset-top),54px)+4px)]">
      <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel" className="h-11 w-11 shrink-0 rounded-full bg-[var(--new-camera-control)] text-[var(--new-white)] hover:bg-[var(--new-camera-control)]"><X className="!size-5" /></Button>
      <Button variant="ghost" onClick={() => setPicker(true)} disabled={groups.length < 2 || recording || starting} className="h-9 min-w-0 gap-1 rounded-full bg-[var(--new-camera-control)] px-3.5 text-[15px] font-bold text-[var(--new-white)] disabled:opacity-100 hover:bg-[var(--new-camera-control)]"><span className="truncate">Checking in to {label}</span>{groups.length > 1 && <ChevronDown className="!size-4" />}</Button>
      <Button variant="ghost" size="icon" onClick={onFlip} disabled={recording || switching || starting} aria-label="Switch camera" className="h-11 w-11 shrink-0 rounded-full bg-[var(--new-camera-control)] text-[var(--new-white)] hover:bg-[var(--new-camera-control)]"><SwitchCamera className="!size-5" /></Button>
    </div>
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+84px)]">
      {attachment && <span className="flex max-w-full items-center gap-2 rounded-full bg-[var(--new-camera-plan)] px-3.5 py-2 text-[14px] font-bold"><Dumbbell size={17} /><span className="truncate">{attachment}</span></span>}
      <div className="relative flex h-[80px] w-[80px] items-center justify-center">
        <svg className="pointer-events-none absolute inset-0 text-[var(--new-white)]" width="80" height="80" viewBox="0 0 80 80" aria-hidden><circle cx="40" cy="40" r="37.5" stroke="currentColor" strokeWidth="5" fill="none" opacity=".35" />{recording && <circle cx="40" cy="40" r="37.5" stroke="currentColor" strokeWidth="5" fill="none" pathLength="1" strokeDasharray={`${progress} 1`} transform="rotate(-90 40 40)" />}</svg>
        <Button variant="ghost" size="icon" onClick={record} disabled={recording || starting || !selected.length} aria-label={recording ? "Recording" : "Start recording"} className="h-[58px] w-[58px] rounded-full border-0 bg-[var(--new-red)] text-[28px] font-extrabold text-[var(--new-white)] shadow-none disabled:opacity-100 hover:bg-[var(--new-red)] hover:text-[var(--new-white)]">{recording ? left : ""}</Button>
      </div>
      <p className="text-[15px] font-semibold" aria-live="polite">{recording ? `Recording · ${left} seconds left` : starting ? "Starting recording" : "Tap to record 5 seconds"}</p>
    </div>
    <NewSheet open={picker} onOpenChange={setPicker} title="Check in to" subtitle="One video counts for every crew you pick.">
        <div>{groups.map((group) => {
          const done = group.members.find((m) => m.isYou)?.status === "done";
          const counts = crewPageCounts(group.members);
          const checked = selected.includes(group.id);
          return <NewSheetRow key={group.id} disabled={done} role="checkbox" aria-checked={checked} aria-label={group.name} onClick={() => toggle(group.id)} title={group.name}
            subtitle={done ? "You're in" : `${counts.done} of ${counts.due} in today`}
            leading={<NewSheetAvatars members={group.members.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl, avatarColor: m.avatarColor }))} />}
            trailing={<NewSheetCheckbox checked={checked} />} />;
        })}</div>
        <NewSheetButton disabled={!selected.length} onClick={() => setPicker(false)}>Done</NewSheetButton>
    </NewSheet>
  </>;
}