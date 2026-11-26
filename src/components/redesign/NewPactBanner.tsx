import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { markPactSeen, type PactStatus } from "@/lib/pact-cycle.functions";
import { newPactBannerBody } from "@/lib/pact-cycle";
import { getMemberGoal, setMemberGoal, GOAL_MAX } from "@/lib/member-goal.functions";
import { NewSheet, NewSheetButton, NewSheetChip } from "./NewSheet";
import { pactStatusOptions } from "./pact-query";

const btn = "flex h-9 items-center rounded-[18px] px-3 text-[13px] font-bold";

/** Between pacts or right after a new one starts; null when there's nothing to say. */
export function NewPactBanner({ groupId, crewName, ownerName, status }: { groupId: string; crewName: string; ownerName: string; status: PactStatus }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mark = useServerFn(markPactSeen);
  const save = useServerFn(setMemberGoal);
  const loadGoal = useServerFn(getMemberGoal);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const dismiss = async () => {
    queryClient.setQueryData(pactStatusOptions(groupId).queryKey, { ...status, bannerSeen: true });
    await mark({ data: { groupId, pactStart: status.start, kind: "banner" } }).catch(() => undefined);
  };

  const card = (title: string, body: string, actions?: ReactNode) => (
    <section className="rounded-[18px]" style={{ background: "#F5F0FF", padding: "14px 16px", margin: "12px 16px 0" }}>
      <h2 className="text-[15px] font-extrabold" style={{ color: "#4C1D95" }}>{title}</h2>
      <p className="mt-1 text-[14px] leading-[1.45]" style={{ color: "#5B21B6" }}>{body}</p>
      {actions ? <div className="mt-[10px] flex gap-2">{actions}</div> : null}
    </section>
  );

  if (status.done) {
    const shown = status.shown[status.viewerId] ?? 0;
    const title = `The ${status.duration}-day pact is done`;
    return status.isOwner
      ? card(title, `You showed up ${shown} of ${status.duration} days. Start the next one to keep ${crewName} going. Streaks and members carry over.`,
          <button type="button" className={btn} style={{ background: "#7C3AED", color: "#FFFFFF" }} onClick={() => navigate({ to: "/crews/$groupId/next-pact", params: { groupId } })}>Start the next pact</button>)
      : card(title, `You showed up ${shown} of ${status.duration} days. ${ownerName} runs ${crewName} and decides what's next. Your streak carries over.`);
  }

  if (!status.previous || status.bannerSeen) return null;
  const last = status.previous.myShown === null ? null : { shown: status.previous.myShown, total: status.previous.duration };
  const title = status.start === status.today ? `New ${status.duration}-day pact started today` : `New ${status.duration}-day pact started`;

  const openGoal = async () => {
    setOpen(true);
    const g = await loadGoal({ data: { groupId } }).catch(() => null);
    setText(g?.goal ?? "");
  };
  const saveGoal = async () => {
    setBusy(true);
    try {
      await save({ data: { groupId, goal: text.trim() } });
      await queryClient.invalidateQueries({ queryKey: ["groups-today"] });
      setOpen(false);
      await dismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {card(title, newPactBannerBody(last), <>
        <button type="button" className={btn} style={{ background: "#7C3AED", color: "#FFFFFF" }} onClick={() => void openGoal()}>Set a new goal</button>
        <button type="button" className={btn} style={{ background: "#EDE4FF", color: "#7C3AED" }} onClick={() => void dismiss()}>Later</button>
      </>)}
      <NewSheet open={open} onOpenChange={setOpen} title="Your goal for this pact" subtitle="Everyone has their own, and your crewmates see it on your row.">
        <div>
          <input aria-label="Your goal" maxLength={GOAL_MAX} value={text} onChange={(e) => setText(e.target.value)} className="h-[52px] w-full rounded-[16px] border border-[var(--new-handle)] bg-[var(--new-white)] px-3 text-[16px] text-[var(--new-ink)] outline-none focus:border-[var(--new-purple)]" />
          <p className="mt-1 text-right text-[12px] text-[var(--new-muted)]">{text.length}/{GOAL_MAX}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Build muscle", "Lose fat", "Stay consistent"].map((chip) => <NewSheetChip key={chip} selected={text === chip} onClick={() => setText(chip)}>{chip}</NewSheetChip>)}
          </div>
          <NewSheetButton disabled={busy || !text.trim()} onClick={() => void saveGoal()}>Save goal</NewSheetButton>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)} className="mt-[10px] h-11 w-full bg-transparent text-[15px] font-bold text-[var(--new-muted)] hover:bg-transparent hover:text-[var(--new-muted)]">Not now</Button>
        </div>
      </NewSheet>
    </>
  );
}
