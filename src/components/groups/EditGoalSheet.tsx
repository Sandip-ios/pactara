import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMemberGoal,
  setMemberGoal,
  GOAL_MAX,
  GOAL_SUGGESTIONS,
} from "@/lib/member-goal.functions";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

const PURPLE = "#7C3AED";
const TEXT_MUTED = "#6B6660";

/** Bottom sheet to edit the current member's personal goal for one group. */
export function EditGoalSheet({
  open,
  onOpenChange,
  groupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
}) {
  const queryClient = useQueryClient();
  const fetchGoal = useServerFn(getMemberGoal);
  const saveGoal = useServerFn(setMemberGoal);

  const { data } = useQuery({
    queryKey: ["member-goal", groupId],
    queryFn: () => fetchGoal({ data: { groupId } }),
    enabled: open,
  });

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setText(data?.goal ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data?.goal]);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      await saveGoal({ data: { groupId, goal: trimmed } });
      await queryClient.invalidateQueries({ queryKey: ["member-goal", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["group-member-streaks"] });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DrawerContent className="rounded-t-3xl">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-[20px] font-bold">Edit my goal</DrawerTitle>
          <DrawerDescription>
            This is yours — not the group's.
            {data?.groupName ? ` Everyone in ${data.groupName} sets their own.` : ""}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-sheet">
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

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-[14px]" role="alert">
              {error}
            </div>
          )}

          <button
            onClick={onSave}
            disabled={!canSave}
            className="mt-5 w-full rounded-full py-4 text-white text-[16px] font-semibold transition-opacity disabled:opacity-40"
            style={{ background: PURPLE, boxShadow: `0 10px 30px -12px ${PURPLE}` }}
          >
            {saving ? "Saving…" : "Save goal"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
