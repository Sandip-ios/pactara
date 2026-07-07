import { useEffect } from "react";
import { Clock, Camera, Eye } from "lucide-react";

const JAKARTA = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";

type Props = {
  open: boolean;
  onClose: () => void;
  onRecord: () => void;
};

function PhoneIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* phone body */}
      <rect x="20" y="6" width="56" height="84" rx="10" fill="#E5E7EB" />
      {/* top notch */}
      <rect x="40" y="10" width="16" height="3" rx="1.5" fill="#CBD1D9" />
      {/* screen */}
      <rect x="26" y="18" width="44" height="56" rx="6" fill="#1F2937" />
      {/* corner brackets */}
      <path d="M31 27 V24 H34" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M65 27 V24 H62" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M31 65 V68 H34" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M65 65 V68 H62" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      {/* person silhouette */}
      <circle cx="48" cy="41" r="6" fill="#9CA3AF" />
      <path d="M36 60 C36 51 60 51 60 60 Z" fill="#9CA3AF" />
      {/* record button */}
      <circle cx="48" cy="82" r="4" fill="#EF4444" />
      {/* home indicator */}
      <rect x="42" y="86" width="12" height="1.5" rx="0.75" fill="#CBD1D9" />
    </svg>
  );
}

function Tip({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 mt-0.5 text-[#111827]">{icon}</div>
      <div className="flex-1">
        <div className="text-[15px] font-bold text-[#111827] leading-tight">{title}</div>
        <div className="mt-1 text-[13px] text-[#6B7280] leading-snug">{desc}</div>
      </div>
    </div>
  );
}

export default function HowToRecordSheet({ open, onClose, onRecord, onSkip }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" style={{ fontFamily: JAKARTA }}>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-[24px] pb-[calc(env(safe-area-inset-bottom)+16px)] animate-in slide-in-from-bottom duration-200"
      >
        <div className="pt-2 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-neutral-300" />
        </div>

        <div className="px-6">
          <div className="pt-2 flex justify-center">
            <PhoneIllustration />
          </div>

          <h2 className="mt-2 text-center text-[22px] font-bold text-[#111827] tracking-tight">
            For the best proof video:
          </h2>

          <div className="mt-4 h-px bg-neutral-200" />

          <div className="mt-5 space-y-5">
            <Tip
              icon={<Clock size={22} strokeWidth={1.75} />}
              title="Keep it to 5–15 seconds"
              desc="Long enough to be real, short enough to be painless"
            />
            <Tip
              icon={<Camera size={22} strokeWidth={1.75} />}
              title="Record live — no uploads"
              desc="Camera only. No photo library access."
            />
            <Tip
              icon={<Eye size={22} strokeWidth={1.75} />}
              title="Show what you actually did"
              desc="Your workout, your meal — make it visible"
            />
          </div>

          <button
            onClick={onRecord}
            className="mt-6 w-full h-14 rounded-full bg-[#111827] text-white text-[16px] font-bold active:opacity-90"
          >
            Record now
          </button>

          <button
            onClick={onSkip}
            className="mt-3 w-full text-center text-[14px] text-neutral-500 py-2"
          >
            Skip for today
          </button>
        </div>
      </div>
    </div>
  );
}
