import { useState } from "react";
import { X } from "lucide-react";
import proofAsset from "@/assets/proof.jpg.asset.json";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

type Props = { firstName: string; onClose: () => void };

const SERIF = 'Georgia, "Times New Roman", serif';
const INK = "#1A1B2A";
const PURPLE = "#7C3AED";

export function OnboardingSheet({ firstName: _firstName, onClose }: Props) {
  useHideBottomTabs();
  const [step, setStep] = useState(0);
  const total = 3;
  const isLast = step === total - 1;



  return (
    <div className="fixed inset-0 z-[80]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 w-full bg-white rounded-t-3xl pt-3 max-h-[92dvh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300 shrink-0" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center text-neutral-500 z-10"
        >
          <X size={18} />
        </button>

        <div className="mt-6 px-5 overflow-y-auto flex-1 pb-4">
          {step === 0 && <StepCommitment />}
          {step === 1 && <StepProof />}
          {step === 2 && <StepSupport />}
        </div>

        <div className="shrink-0 px-5 pt-3 pb-6 bg-white border-t border-neutral-100">
          <div className="flex items-center justify-center gap-2 mb-4">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? 22 : 6,
                  height: 6,
                  background: i === step ? PURPLE : "#E5DED4",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => (isLast ? onClose() : setStep(step + 1))}
            className="w-full rounded-full py-4 text-white text-[16px] font-semibold shadow-lg"
            style={{ background: PURPLE, boxShadow: `0 10px 30px -10px ${PURPLE}` }}
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCommitment() {
  return (
    <div>
      <div className="rounded-3xl px-6 py-8 flex items-center justify-center" style={{ background: "linear-gradient(180deg,#FCEFE4,#F8E2D1)" }}>
        <div className="w-full max-w-[300px] rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full" style={{ background: "#E07A3B" }} />
            <span className="text-[14px] font-semibold text-neutral-800">You · 6:42 AM</span>
          </div>
          <p className="mt-2 text-[15px] text-neutral-900 leading-snug">
            "Leg day. No excuses. Locking this in for my pod 💪"
          </p>
          <div className="mt-3 inline-block px-3 py-1 rounded-full text-[12px] font-bold" style={{ background: "#FCE3D0", color: "#C75A1F" }}>
            Today's commitment
          </div>
        </div>
      </div>

      <h2 className="mt-7 text-center text-[26px] leading-tight" style={{ fontFamily: SERIF, color: INK }}>
        Post your morning commitment
      </h2>
      <p className="mt-3 text-center text-[15px] text-neutral-500 leading-relaxed px-2">
        Start the day by telling your pod exactly what you're going to do. Saying it out loud is the first step to actually doing it.
      </p>
    </div>
  );
}

function StepProof() {
  return (
    <div>
      <div className="rounded-3xl px-6 py-8 flex items-center justify-center" style={{ background: "#E9DEFB" }}>
        <div className="relative w-[180px] h-[230px] rounded-2xl overflow-hidden border-4 border-[#1A1B2A] bg-neutral-800">
          <img src={proofAsset.url} alt="Check-in proof" loading="lazy" width={512} height={672} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-white text-[11px] font-semibold" style={{ background: "#7C3AED" }}>
            Leg day ✓
          </span>
          <span className="absolute bottom-3 right-3 h-7 w-7 rounded-full bg-white flex items-center justify-center text-[#7C3AED] text-[14px] font-bold">
            ✓
          </span>
        </div>
      </div>

      <h2 className="mt-7 text-center text-[26px] leading-tight" style={{ fontFamily: SERIF, color: INK }}>
        Check in with proof
      </h2>
      <p className="mt-3 text-center text-[15px] text-neutral-500 leading-relaxed px-2">
        Snap a photo when you follow through. A real check-in beats a checkbox — your pod sees the actual work, not just a claim.
      </p>
    </div>
  );
}

function StepSupport() {
  return (
    <div>
      <div className="rounded-3xl px-5 py-8 space-y-3" style={{ background: "linear-gradient(180deg,#FCE1DA,#F9D5CC)" }}>
        <div className="flex">
          <div className="rounded-full bg-white px-4 py-2.5 shadow-sm flex items-center gap-2">
            <span className="h-5 w-5 rounded-full" style={{ background: "#7C3AED" }} />
            <span className="text-[14px] font-semibold text-neutral-900">Marcus checked in 🔥</span>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="rounded-full bg-white px-4 py-2.5 shadow-sm flex items-center gap-2">
            <span className="text-[14px]">❤️</span>
            <span className="text-[14px] font-semibold text-neutral-900">Nice work!</span>
          </div>
        </div>
        <div className="flex">
          <div className="rounded-full bg-white px-4 py-2.5 shadow-sm flex items-center gap-2">
            <span className="h-5 w-5 rounded-full" style={{ background: "#D97706" }} />
            <span className="text-[14px] font-semibold text-neutral-900">Ava is on a 12-day streak</span>
          </div>
        </div>
      </div>

      <h2 className="mt-7 text-center text-[26px] leading-tight" style={{ fontFamily: SERIF, color: INK }}>
        Support your pod
      </h2>
      <p className="mt-3 text-center text-[15px] text-neutral-500 leading-relaxed px-2">
        Cheer on your group when they check in. The accountability goes both ways — showing up for them keeps you showing up too.
      </p>
    </div>
  );
}
