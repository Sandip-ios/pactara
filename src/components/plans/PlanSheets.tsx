import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { ConfirmSheet } from "@/components/workout/ConfirmSheet";
import { FONT, W } from "@/components/workout/WorkoutBits";
import { leavePlan, type MyActivePlan } from "@/lib/plans.functions";

/** "Build Muscle · week 3 of 8" */
export const planWeekTitle = (p: Pick<MyActivePlan, "name" | "currentWeek" | "weeks">) => `${p.name} · week ${p.currentWeek} of ${p.weeks}`;

/** Plan ••• sheet: a title, rows (destructive last) and an outlined Cancel. */
export function PlanOptionsSheet({
  open,
  title,
  rows,
  onClose,
}: {
  open: boolean;
  title: string;
  rows: { label: string; danger?: boolean; onClick: () => void }[];
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]" style={{ fontFamily: FONT, color: W.ink }}>
        <div className="flex flex-col px-4 pt-3">
          <DrawerTitle className="pb-3 text-[17px] font-extrabold">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">Plan options</DrawerDescription>
          {rows.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                onClose();
                r.onClick();
              }}
              className="h-[52px] text-left text-[16px] font-semibold"
              style={{ color: r.danger ? "#DC2626" : W.ink, borderTop: `1px solid ${W.divider}` }}
            >
              {r.label}
            </button>
          ))}
          <button type="button" onClick={onClose} className="mt-1 h-[52px] rounded-[26px] text-[16px] font-bold" style={{ border: `1.5px solid ${W.line}` }}>
            Cancel
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** "Leave Build Muscle?" confirm, then leaves and refreshes everything that shows the plan. */
export function LeavePlanSheet({ plan, open, onClose, onLeft }: { plan: MyActivePlan | null; open: boolean; onClose: () => void; onLeft?: () => void }) {
  const qc = useQueryClient();
  const leave = useServerFn(leavePlan);
  const [busy, setBusy] = useState(false);
  if (!plan) return null;
  return (
    <ConfirmSheet
      open={open}
      title={`Leave ${plan.name}?`}
      body={`Your logged workouts and personal bests stay in your history. You can pick it back up at week ${plan.currentWeek} any time. Your subscription isn’t affected.`}
      confirmLabel={busy ? "Leaving…" : "Leave plan"}
      cancelLabel="Keep going"
      cancelOutlined
      danger
      onCancel={onClose}
      onConfirm={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await leave({ data: { userPlanId: plan.id } });
          await qc.invalidateQueries({ queryKey: ["my-plans"] });
          void qc.invalidateQueries({ queryKey: ["crew-plans"] });
          void qc.invalidateQueries({ queryKey: ["crew-on-plan"] });
          onClose();
          toast(`You left ${plan.name}`);
          onLeft?.();
        } catch (e) {
          console.error("[plans] leave failed", e);
          toast.error("Couldn't leave the plan. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** Starting another plan while on one. */
export function SwitchPlanSheet({
  open,
  toName,
  current,
  onSwitch,
  onClose,
}: {
  open: boolean;
  toName: string;
  current: Pick<MyActivePlan, "name" | "currentWeek"> | null;
  onSwitch: () => void;
  onClose: () => void;
}) {
  if (!current) return null;
  return (
    <ConfirmSheet
      open={open}
      title={`Switch to ${toName}?`}
      body={`You’ll leave ${current.name} at week ${current.currentWeek}. Your logged workouts stay in your history, and you can pick ${current.name} back up later.`}
      confirmLabel="Switch plan"
      cancelLabel={`Stay on ${current.name}`}
      cancelOutlined
      onCancel={onClose}
      onConfirm={onSwitch}
    />
  );
}
