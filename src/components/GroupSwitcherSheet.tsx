import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

export type SwitcherGroup = {
  id: string;
  name: string;
  emoji?: string | null;
  memberCount?: number;
  durationDays?: number;
  startDate?: string | null;
  createdAt?: string | null;
  members?: {
    id: string;
    name: string;
    avatarColor: string;
    avatarUrl: string | null;
  }[];
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
  allowAll = false,
}: {
  open: boolean;
  onClose: () => void;
  groups: SwitcherGroup[];
  selectedGroupId: string | null;
  onSelect: (id: string) => void;
  /** Adds an "All groups" row that selects the id "all". */
  allowAll?: boolean;
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
        className="absolute inset-0 bg-foreground/40 transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-background transition-transform duration-200 ease-out"
        style={{
          transform: shown ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)",
          boxShadow: "0 -8px 30px color-mix(in oklab, var(--foreground) 18%, transparent)",
        }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="px-5 pt-1 pb-3">
          <h2 className="text-[17px] leading-6 font-bold text-foreground">Switch group</h2>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-3 pb-2">
          {allowAll && (
            <button
              onClick={() => {
                onSelect("all");
                onClose();
              }}
              className="w-full flex items-center gap-4 px-2 py-4 text-left active:bg-muted"
            >
              <span
                className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center bg-muted text-[18px]"
              >
                🔔
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] leading-6 font-bold text-foreground">All groups</span>
                <span className="mt-0.5 block text-[14px] leading-5 text-muted-foreground">
                  Everything from your {groups.length} group{groups.length === 1 ? "" : "s"}
                </span>
              </span>
              {selectedGroupId === "all" && (
                <span className="h-6 w-6 rounded-full flex items-center justify-center bg-pactara-purple text-pactara-purple-foreground">
                  <Check size={15} strokeWidth={3} />
                </span>
              )}
            </button>
          )}
          {groups.map((g) => {
            const active = g.id === selectedGroupId;
            const { dayNumber, duration } = dayNumberFor(g);
            const members = g.members ?? [];
            const showStack = members.length > 0;
            return (
              <button
                key={g.id}
                onClick={() => {
                  onSelect(g.id);
                  onClose();
                }}
                className="w-full flex items-center gap-4 px-2 py-4 text-left active:bg-muted"
              >
                {showStack ? (
                  <span className="relative flex shrink-0 items-center">
                    <span className="flex -space-x-5">
                      {members.slice(0, 3).map((m) => (
                        <span
                          key={m.id}
                          className="h-11 w-11 rounded-full ring-2 ring-background overflow-hidden flex items-center justify-center text-primary-foreground text-[14px] font-bold"
                          style={{ background: m.avatarColor }}
                        >
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            (m.name || "?").charAt(0).toUpperCase()
                          )}
                        </span>
                      ))}
                      {members.length > 3 && (
                        <span className="h-11 w-11 rounded-full ring-2 ring-background flex items-center justify-center bg-pactara-purple-soft text-pactara-purple text-[14px] font-bold">
                          +{members.length - 3}
                        </span>
                      )}
                    </span>
                  </span>
                ) : (
                  <span
                    className="h-11 w-[64px] shrink-0 rounded-full flex items-center justify-center bg-muted text-[20px]"
                  >
                    {g.emoji || "👥"}
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[17px] leading-6 font-bold text-foreground">
                    {g.name}
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-5 text-muted-foreground">
                    {g.memberCount ? `${g.memberCount} member${g.memberCount === 1 ? "" : "s"} · ` : ""}
                    Day {dayNumber} of {duration}
                  </span>
                </span>
                {active && (
                  <span className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center bg-pactara-purple text-pactara-purple-foreground">
                    <Check size={15} strokeWidth={3} />
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
