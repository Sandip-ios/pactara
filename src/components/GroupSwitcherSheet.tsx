import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

const PURPLE = "#7C3AED";

export type SwitcherGroup = {
  id: string;
  name: string;
  emoji?: string | null;
  memberCount?: number;
  durationDays?: number;
  startDate?: string | null;
  createdAt?: string | null;
};

function dayNumberFor(g: SwitcherGroup) {
  const duration = g.durationDays ?? 30;
  const source = g.startDate ?? g.createdAt;
  if (!source) return { dayNumber: 1, duration };
  const start = g.startDate ? new Date(`${g.startDate}T00:00:00`) : new Date(source);
  const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((todayLocal.getTime() - startLocal.getTime()) / 86400000);
  return { dayNumber: Math.min(duration, Math.max(1, diff + 1)), duration };
}

export default function GroupSwitcherSheet({
  open,
  onClose,
  groups,
  selectedGroupId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  groups: SwitcherGroup[];
  selectedGroupId: string | null;
  onSelect: (id: string) => void;
}) {
  useHideBottomTabs(open);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(t);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[22px] bg-white transition-transform duration-200 ease-out"
        style={{
          transform: shown ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="px-5 pt-1 pb-2">
          <h2 className="text-[17px] font-bold text-neutral-900">Switch group</h2>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-2 pb-2">
          {groups.map((g) => {
            const active = g.id === selectedGroupId;
            const { dayNumber, duration } = dayNumberFor(g);
            return (
              <button
                key={g.id}
                onClick={() => {
                  onSelect(g.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-neutral-100"
              >
                <span
                  className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-[20px]"
                  style={{ background: active ? "#EFE9FB" : "#F5F2EE" }}
                >
                  {g.emoji || "👥"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[16px] font-semibold text-neutral-900">
                    {g.name}
                  </span>
                  <span className="block text-[13px] text-neutral-500">
                    {g.memberCount ? `${g.memberCount} member${g.memberCount === 1 ? "" : "s"} · ` : ""}
                    Day {dayNumber} of {duration}
                  </span>
                </span>
                {active && (
                  <span
                    className="h-6 w-6 rounded-full flex items-center justify-center text-white"
                    style={{ background: PURPLE }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
