import { useEffect } from "react";
import { Clock, Camera, Eye } from "lucide-react";


const JAKARTA = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";

type Props = {
  open: boolean;
  onClose: () => void;
  onRecord: () => void;
};

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

export default function HowToRecordSheet({ open, onClose, onRecord }: Props) {
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
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-[24px] pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
      >
        <div className="pt-2 flex justify-center sticky top-0 bg-white z-10">
          <div className="h-1.5 w-10 rounded-full bg-neutral-300" />
        </div>

        <div className="px-6">
          <div className="pt-4 flex justify-center">
            <img
              src={phoneImage}
              alt="Phone recording a proof video"
              width={1024}
              height={1024}
              loading="lazy"
              className="w-[260px] h-[260px] object-contain"
            />
          </div>

          <h2 className="mt-2 text-center text-[22px] font-bold text-[#111827] tracking-tight">
            For the best proof video:
          </h2>

          <div className="mt-6 space-y-5">
            <Tip
              icon={<Clock size={24} strokeWidth={1.75} />}
              title="Keep it to 5–15 seconds"
              desc="Long enough to be real, short enough to be painless"
            />
            <Tip
              icon={<Camera size={24} strokeWidth={1.75} />}
              title="Record live — no uploads"
              desc="Camera only. No photo library access."
            />
            <Tip
              icon={<Eye size={24} strokeWidth={1.75} />}
              title="Show what you actually did"
              desc="Your workout, your meal — make it visible"
            />
          </div>

          <button
            onClick={onRecord}
            className="mt-8 mb-2 w-full h-14 rounded-full bg-[#111827] text-white text-[16px] font-bold active:opacity-90"
          >
            Record now
          </button>
        </div>
      </div>
    </div>
  );
}
