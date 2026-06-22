import { useState } from "react";
import { Flame, Sun, CheckCircle2, Camera, X, ChevronRight, Check } from "lucide-react";

const PURPLE = "#7C3AED";

type Props = { firstName: string; onClose: () => void };

export function OnboardingSheet({ firstName, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState("Hit the gym before 8am — chest & shoulders. No excuses. 💪");
  const total = 4;

  const accent =
    step === 0 ? PURPLE : step === 1 ? "#F59E0B" : step === 2 ? "#22C55E" : PURPLE;

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-[#F5F2EE] rounded-t-3xl pt-3 pb-8 px-6 max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300" />

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 28 : 12,
                  background: i === step ? accent : "#D4D4D4",
                }}
              />
            ))}
          </div>
          <button onClick={onClose} className="flex items-center gap-1 text-neutral-500 text-[15px] font-medium">
            Skip <X size={16} />
          </button>
        </div>

        {step === 0 && (
          <StepWelcome firstName={firstName} />
        )}
        {step === 1 && (
          <StepMorning plan={plan} setPlan={setPlan} />
        )}
        {step === 2 && (
          <StepCheckin onTry={() => setStep(3)} />
        )}
        {step === 3 && (
          <StepPhoto />
        )}

        <div className="mt-6 space-y-3">
          {step === 2 ? (
            <button
              onClick={() => setStep(3)}
              className="w-full rounded-full py-4 bg-white border border-neutral-200 text-neutral-700 text-[16px] font-semibold flex items-center justify-center gap-2"
            >
              Continue tour <ChevronRight size={18} />
            </button>
          ) : step < total - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="w-full rounded-full py-4 text-white text-[16px] font-semibold flex items-center justify-center gap-2 shadow-lg"
              style={{ background: accent, boxShadow: `0 10px 30px -10px ${accent}` }}
            >
              Next <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full rounded-full py-4 text-white text-[16px] font-semibold shadow-lg"
              style={{ background: accent, boxShadow: `0 10px 30px -10px ${accent}` }}
            >
              Let's go 🔥
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepWelcome({ firstName }: { firstName: string }) {
  return (
    <div className="mt-6">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white" style={{ background: PURPLE }}>
        <Flame size={28} />
      </div>
      <div className="mt-3 inline-block px-3 py-1 rounded-full bg-purple-100 text-[11px] font-bold tracking-wider" style={{ color: PURPLE }}>
        WELCOME
      </div>
      <h2 className="mt-3 text-[28px] font-black leading-tight tracking-tight">
        Hey {firstName}, welcome to Pactara! 🔥
      </h2>
      <p className="mt-3 text-[15px] text-neutral-600 leading-relaxed">
        Pactara keeps you showing up — every single day. Your group sees your check-ins, cheers you on, and holds you honest. Here's how it works.
      </p>

      <div className="mt-5 space-y-3">
        <PreviewRow initial="J" name="Jamie" badge="CRUSHED IT" badgeBg="bg-green-100" badgeColor="text-green-600" sub="5am. No excuses." />
        <PreviewRow initial="T" name="Taylor" badge="MADE PROGRESS" badgeBg="bg-amber-100" badgeColor="text-amber-600" sub="Lighter session today" />
        <PreviewRow initial="Y" name="You" sub="Your turn 👇" muted />
      </div>
    </div>
  );
}

function PreviewRow({ initial, name, badge, badgeBg, badgeColor, sub, muted }: {
  initial: string; name: string; badge?: string; badgeBg?: string; badgeColor?: string; sub: string; muted?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 flex items-center gap-3 shadow-sm">
      <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white font-bold ${muted ? "bg-neutral-300" : ""}`} style={!muted ? { background: PURPLE } : undefined}>
        {initial}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[15px]">{name}</span>
          {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeBg} ${badgeColor}`}>{badge}</span>}
        </div>
        <div className="text-[13px] text-neutral-500">{sub}</div>
      </div>
    </div>
  );
}

function StepMorning({ plan, setPlan }: { plan: string; setPlan: (s: string) => void }) {
  return (
    <div className="mt-6">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white" style={{ background: "#F59E0B" }}>
        <Sun size={28} />
      </div>
      <div className="mt-3 inline-block px-3 py-1 rounded-full bg-amber-100 text-[11px] font-bold tracking-wider text-amber-600">
        MORNING RITUAL
      </div>
      <h2 className="mt-3 text-[28px] font-black leading-tight tracking-tight">
        Start every morning with your plan
      </h2>
      <p className="mt-3 text-[15px] text-neutral-600 leading-relaxed">
        Each day, post what you're going to do before you do it. Your group sees it — which means you're accountable before you even start.
      </p>

      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-bold text-[14px] text-amber-600">🌅 Morning Ritual</span>
          </div>
          <span className="text-[12px] text-neutral-400">Before noon</span>
        </div>
        <div className="mt-3 font-bold text-[15px]">What's your plan for today?</div>
        <textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="mt-2 w-full rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-3 text-[14px] text-amber-900 outline-none resize-none"
          rows={2}
        />
        <button className="mt-3 w-full rounded-xl py-3 text-white font-semibold" style={{ background: "linear-gradient(180deg,#FBBF24,#F59E0B)" }}>
          Post my plan 🌅
        </button>
        <div className="mt-2 text-center text-[12px] text-neutral-400">
          Your group will see this — that's the point.
        </div>
      </div>
    </div>
  );
}

function StepCheckin({ onTry }: { onTry: () => void }) {
  const [picked, setPicked] = useState(0);
  const opts = [
    { label: "Crushed it", sub: "Trained, tracked, or hit my target today", icon: <Check size={16} className="text-white" />, iconBg: "bg-white/20" },
    { label: "Made progress", sub: "Partial workout or lighter session", icon: <span>🤏</span>, iconBg: "" },
    { label: "Missed it", sub: "Rest day or skipped — being honest", icon: <span>❌</span>, iconBg: "" },
  ];
  return (
    <div className="mt-6">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white" style={{ background: "#22C55E" }}>
        <CheckCircle2 size={28} />
      </div>
      <div className="mt-3 inline-block px-3 py-1 rounded-full bg-green-100 text-[11px] font-bold tracking-wider text-green-600">
        DAILY CHECK-IN
      </div>
      <h2 className="mt-3 text-[28px] font-black leading-tight tracking-tight">
        Check in every day — it takes 10 seconds
      </h2>
      <p className="mt-3 text-[15px] text-neutral-600 leading-relaxed">
        At the end of the day, tap Check In and mark how it went. Crushed it, made progress, or missed it — honesty is what makes the group work.
      </p>

      <div className="mt-5 rounded-2xl p-3 space-y-2" style={{ background: "#22C55E" }}>
        {opts.map((o, i) => (
          <button
            key={i}
            onClick={() => setPicked(i)}
            className={`w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left ${picked === i ? "bg-white/10 border-2 border-white" : "bg-white/5 border-2 border-transparent"}`}
          >
            <div className={`h-7 w-7 rounded flex items-center justify-center ${picked === i ? "bg-white" : ""}`}>
              {picked === i ? <Check size={18} className="text-green-600" /> : <span className="text-lg">{i === 1 ? "🤏" : "❌"}</span>}
            </div>
            <div>
              <div className="text-white font-bold text-[15px]">{o.label}</div>
              <div className="text-white/80 text-[12px]">{o.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onTry}
        className="mt-4 w-full rounded-full py-4 text-white text-[16px] font-semibold shadow-lg"
        style={{ background: "#22C55E", boxShadow: "0 10px 30px -10px #22C55E" }}
      >
        Try it now →
      </button>
    </div>
  );
}

function StepPhoto() {
  return (
    <div className="mt-6">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white" style={{ background: PURPLE }}>
        <Camera size={28} />
      </div>
      <div className="mt-3 inline-block px-3 py-1 rounded-full bg-purple-100 text-[11px] font-bold tracking-wider" style={{ color: PURPLE }}>
        PHOTO POSTS
      </div>
      <h2 className="mt-3 text-[28px] font-black leading-tight tracking-tight">
        Share proof. Celebrate wins.
      </h2>
      <p className="mt-3 text-[15px] text-neutral-600 leading-relaxed">
        Snap a photo of your workout, your meal, or your progress and post it to the group feed. Seeing is believing — for you and your crew.
      </p>

      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: PURPLE }}>M</div>
          <div>
            <div className="text-[14px]"><span className="font-bold">Morgan</span> <span className="text-neutral-500">checked in</span></div>
            <div className="text-[12px] text-neutral-500">just now · 🏆 <span className="text-green-600 font-semibold">Crushed it</span></div>
          </div>
        </div>
        <div className="mt-3 pl-2 border-l-2 border-amber-300 space-y-2">
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="text-[13px] font-bold text-amber-700">🌅 Morning Ritual</div>
            <div className="text-[13px] text-amber-900">"Hit the gym before 8am today"</div>
          </div>
          <div className="rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-3 flex items-center gap-3">
            <Camera size={20} style={{ color: PURPLE }} />
            <div>
              <div className="text-[13px] font-bold" style={{ color: PURPLE }}>💪 Workout · Day 14</div>
              <div className="text-[12px] text-neutral-600">Post-workout selfie</div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-[13px] font-bold">🔥 7</span>
          <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 text-[13px] font-bold">💬 3</span>
        </div>
      </div>
    </div>
  );
}
