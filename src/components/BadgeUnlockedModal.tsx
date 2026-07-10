import { useEffect } from "react";
import { X } from "lucide-react";
import { BADGE_META } from "@/lib/badges";

export type BadgeUnlockedModalProps = {
  badges: number[];
  onClose: () => void;
};

export function BadgeUnlockedModal({ badges, onClose }: BadgeUnlockedModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const primary = badges[badges.length - 1];
  const meta = BADGE_META[primary];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Badge unlocked"
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      style={{
        background: "rgba(11, 18, 32, 0.72)",
        fontFamily: "Inter, system-ui, sans-serif",
        animation: "badge-fade 220ms ease-out both",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.25)", animation: "badge-pop 260ms cubic-bezier(0.2,0.9,0.3,1.2) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-9 w-9 rounded-full flex items-center justify-center bg-neutral-100 text-neutral-700"
        >
          <X size={18} />
        </button>

        <div className="pt-2 text-[11px] font-bold tracking-[0.16em]" style={{ color: "#1A73E8" }}>
          {badges.length > 1 ? "NEW BADGES UNLOCKED" : "NEW BADGE UNLOCKED"}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          {badges.slice(-3).map((d) => (
            <img
              key={d}
              src={BADGE_META[d]?.image}
              alt=""
              width={112}
              height={112}
              className="h-28 w-28"
            />
          ))}
        </div>

        <div className="mt-5 text-[22px] font-black tracking-tight text-neutral-900">
          {meta?.title ?? `Day ${primary}`}
        </div>
        {meta?.blurb && (
          <div className="mt-1 text-[15px] text-neutral-500">{meta.blurb}</div>
        )}

        {badges.length > 1 && (
          <div className="mt-3 text-[13px] text-neutral-400">
            + {badges.length - 1} more milestone{badges.length - 1 > 1 ? "s" : ""} earned
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 h-12 w-full rounded-2xl text-[15px] font-semibold text-white"
          style={{ background: "#1A73E8" }}
        >
          Nice
        </button>
      </div>

      <style>{`
        @keyframes badge-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes badge-pop {
          0%   { opacity: 0; transform: scale(0.9) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default BadgeUnlockedModal;
