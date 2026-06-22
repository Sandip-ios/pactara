import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, Camera, Check, Scale } from "lucide-react";
import goodCompany from "@/assets/good-company.jpg.asset.json";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Pactara account" },
      { name: "description", content: "Set up your group and start your commitment." },
    ],
  }),
  component: SignupFlow,
});

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const PURPLE_SOFT = "#F3EEFF";
const PURPLE_BORDER = "#C9B8FF";
const INPUT_BG = "#EFEDEA";
const LABEL = "#8A8580";
const TEXT_MUTED = "#6B6660";
const TEXT = "#0A0A0A";
const TRACK = "#EAE4F5";

const GOALS = [
  { id: "lose-weight", emoji: "⚖️", label: "Lose weight", blurb: "Track food, move daily, and build the habits that stick" },
  { id: "build-muscle", emoji: "💪", label: "Build muscle", blurb: "Progressive lifting with your crew keeping you honest" },
  { id: "run", emoji: "🏃", label: "Run consistently", blurb: "Lace up together, week after week" },
  { id: "eat-better", emoji: "🥗", label: "Eat better", blurb: "Whole foods, real meals, shared wins" },
  { id: "race", emoji: "🏅", label: "Train for a race", blurb: "Show up to the start line ready" },
  { id: "general", emoji: "🔥", label: "General fitness", blurb: "Move every day. Feel better. Together." },
  { id: "75-hard", emoji: "🪖", label: "75 Hard", blurb: "The full program. No compromises." },
];

const ICON_FOR_GOAL: Record<string, string> = {
  "lose-weight": "⚖️",
  "build-muscle": "💪",
  run: "🏃",
  "eat-better": "🥗",
  race: "🏅",
  general: "🔥",
  "75-hard": "🪖",
};

type StepKey = "name" | "email" | "photo" | "goal" | "group" | "commitment" | "final";
const STEPS: StepKey[] = ["name", "email", "photo", "goal", "group", "commitment", "final"];

function SignupFlow() {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [duration, setDuration] = useState<30 | 60 | 90 | "custom">(30);
  const [customDays, setCustomDays] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [daysPerWeek, setDaysPerWeek] = useState(3);

  const step = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  const goalLabel = useMemo(() => GOALS.find((g) => g.id === goal)?.label ?? "your goal", [goal]);
  const goalEmoji = goal ? ICON_FOR_GOAL[goal] : "🎯";

  // Auto-generate group name when goal picked
  const ensureGroupName = () => {
    if (!groupName && goal) {
      const g = GOALS.find((x) => x.id === goal)!;
      setGroupName(`${g.label} Crew`);
    }
  };

  const next = () => {
    if (step === "goal") ensureGroupName();
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const back = () => {
    if (stepIdx === 0) navigate({ to: "/" });
    else setStepIdx((i) => i - 1);
  };

  const canContinue = (() => {
    switch (step) {
      case "name":
        return firstName.trim().length > 0;
      case "email":
        return /\S+@\S+\.\S+/.test(email);
      case "photo":
        return true; // skip allowed
      case "goal":
        return goal !== null;
      case "group":
        return groupName.trim().length > 0;
      case "commitment":
        return duration !== "custom" || customDays.trim().length > 0;
      default:
        return true;
    }
  })();

  if (step === "final") return <FinalStep onGo={() => navigate({ to: "/" })} />;

  return (
    <div
      className="min-h-screen w-full flex flex-col px-6 pt-14 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT }}
    >
      {/* Progress bar */}
      <div className="flex items-center gap-3 mt-6">
        {stepIdx > 0 && (
          <button onClick={back} aria-label="Back" className="-ml-1 p-1 shrink-0">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: TRACK }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: PURPLE }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="mt-10 flex-1">
        {step === "name" && <NameStep firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} />}
        {step === "email" && <EmailStep firstName={firstName} email={email} setEmail={setEmail} />}
        {step === "photo" && <PhotoStep photo={photo} setPhoto={setPhoto} />}
        {step === "goal" && <GoalStep goal={goal} setGoal={setGoal} />}
        {step === "group" && (
          <GroupStep groupName={groupName} setGroupName={setGroupName} firstName={firstName} goalLabel={goalLabel} goalEmoji={goalEmoji} />
        )}
        {step === "commitment" && (
          <CommitmentStep
            goalLabel={goalLabel.toLowerCase()}
            duration={duration}
            setDuration={setDuration}
            customDays={customDays}
            setCustomDays={setCustomDays}
            frequency={frequency}
            setFrequency={setFrequency}
            daysPerWeek={daysPerWeek}
            setDaysPerWeek={setDaysPerWeek}
          />
        )}
      </div>

      {/* Footer actions */}
      <div className="flex flex-col items-center gap-3 pt-6">
        {step === "photo" && !photo ? (
          <>
            <PrimaryButton
              disabled={false}
              dimmed
              onClick={() => document.getElementById("photo-input")?.click()}
              label="Choose a photo first"
            />
            <button onClick={next} className="text-[15px] font-medium" style={{ color: TEXT_MUTED }}>
              Skip for now
            </button>
          </>
        ) : (
          <PrimaryButton
            disabled={!canContinue}
            onClick={next}
            label="Continue"
            withArrow
          />
        )}
      </div>
    </div>
  );
}

/* ------------ Primary Button ------------ */
function PrimaryButton({
  onClick,
  label,
  disabled,
  withArrow,
  dimmed,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  withArrow?: boolean;
  dimmed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl py-5 flex items-center justify-center gap-2 text-[17px] font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-50"
      style={{
        background: dimmed
          ? `linear-gradient(180deg, #A78BFA 0%, ${PURPLE} 100%)`
          : `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
        boxShadow: "0 14px 34px -14px rgba(124, 58, 237, 0.55)",
      }}
    >
      {label}
      {withArrow && <ArrowRight size={20} />}
    </button>
  );
}

/* ------------ Field ------------ */
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl px-5 pt-4 pb-4" style={{ background: INPUT_BG }}>
      <div className="text-[12px] font-semibold tracking-wider" style={{ color: LABEL }}>
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inputClass = "w-full bg-transparent outline-none text-[17px]";

/* ------------ Step: Name ------------ */
function NameStep({
  firstName,
  setFirstName,
  lastName,
  setLastName,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
}) {
  return (
    <div>
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.05]">What's your name?</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        This is how your group will know you.
      </p>
      <div className="mt-7 flex flex-col gap-4">
        <Field label="FIRST NAME">
          <input className={inputClass} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
        </Field>
        <Field label="LAST NAME">
          <input className={inputClass} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

/* ------------ Step: Email ------------ */
function EmailStep({
  firstName,
  email,
  setEmail,
}: {
  firstName: string;
  email: string;
  setEmail: (v: string) => void;
}) {
  return (
    <div>
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">
        What's your email{firstName ? `, ${firstName}` : ""}?
      </h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        You'll use this to log in and receive important updates.
      </p>
      <div className="mt-7">
        <Field label="EMAIL ADDRESS">
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </Field>
      </div>
    </div>
  );
}

/* ------------ Step: Photo ------------ */
function PhotoStep({ photo, setPhoto }: { photo: string | null; setPhoto: (v: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
  };

  return (
    <div>
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.05]">Add a profile photo</h1>
      <p className="mt-3 text-[16px] leading-[1.45]" style={{ color: TEXT_MUTED }}>
        Groups with photos are 3× more likely to stay accountable.
      </p>

      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-[240px] h-[240px] rounded-full flex items-center justify-center"
          style={{ background: PURPLE_SOFT }}
        >
          {/* Dashed inner ring */}
          <div
            className="absolute inset-3 rounded-full"
            style={{
              border: `2px dashed ${PURPLE_BORDER}`,
            }}
          />
          {photo ? (
            <img src={photo} alt="Profile" className="w-full h-full object-cover rounded-full" />
          ) : (
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="9" r="3.5" fill={PURPLE_BORDER} />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill={PURPLE_BORDER} />
            </svg>
          )}
          {/* Camera badge */}
          <div
            className="absolute right-3 bottom-3 w-12 h-12 rounded-full flex items-center justify-center text-white"
            style={{
              background: PURPLE,
              border: "4px solid white",
              boxShadow: "0 6px 16px -6px rgba(124,58,237,0.55)",
            }}
          >
            <Camera size={20} />
          </div>
        </button>
        <input
          id="photo-input"
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
      </div>
    </div>
  );
}

/* ------------ Step: Goal ------------ */
function GoalStep({ goal, setGoal }: { goal: string | null; setGoal: (v: string) => void }) {
  return (
    <div>
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">What's your fitness goal?</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        Your group will train toward this together.
      </p>

      <div className="mt-6 flex flex-col gap-3 pb-2">
        {GOALS.map((g) => {
          const selected = goal === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className="w-full rounded-2xl px-4 py-4 flex items-start gap-3 text-left transition"
              style={{
                background: selected ? "#FFF4ED" : INPUT_BG,
                border: selected ? "2px solid #F97316" : "2px solid transparent",
                boxShadow: selected ? "0 10px 24px -16px rgba(249,115,22,0.4)" : "none",
              }}
            >
              <span className="text-[22px] leading-none mt-0.5">{g.emoji}</span>
              <div className="flex-1">
                <div className="text-[17px] font-semibold">{g.label}</div>
                {selected && (
                  <div className="mt-1 text-[14px] leading-[1.4]" style={{ color: TEXT_MUTED }}>
                    {g.blurb}
                  </div>
                )}
              </div>
              {selected && <Check size={20} className="mt-1" color="#F97316" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------ Step: Group ------------ */
function GroupStep({
  groupName,
  setGroupName,
  goalLabel,
  goalEmoji,
}: {
  groupName: string;
  setGroupName: (v: string) => void;
  firstName: string;
  goalLabel: string;
  goalEmoji: string;
}) {
  return (
    <div>
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.05]">Name your group</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        Your friends will see this when they join.
      </p>

      {/* Preview card */}
      <div className="mt-7 rounded-2xl bg-white p-4 flex items-center gap-3" style={{ boxShadow: "0 6px 24px -10px rgba(0,0,0,0.08)" }}>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-[26px]"
          style={{ background: "linear-gradient(135deg, #F97316 0%, #C026D3 100%)" }}
        >
          <Scale size={26} color="white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold flex items-center gap-1.5 truncate">
            <span>{goalEmoji}</span>
            <span className="truncate">{groupName || `${goalLabel} Crew`}</span>
          </div>
          <div className="text-[13px] mt-0.5" style={{ color: TEXT_MUTED }}>
            1 member · Day 1
          </div>
        </div>
      </div>

      <div className="mt-5">
        <Field label="GROUP NAME">
          <div className="flex items-center gap-2">
            <span className="text-[18px]">{goalEmoji}</span>
            <input
              className={inputClass}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={`${goalLabel} Crew`}
              autoFocus
            />
          </div>
        </Field>
      </div>
    </div>
  );
}

/* ------------ Step: Commitment ------------ */
function CommitmentStep({
  goalLabel,
  duration,
  setDuration,
  customDays,
  setCustomDays,
  frequency,
  setFrequency,
  daysPerWeek,
  setDaysPerWeek,
}: {
  goalLabel: string;
  duration: 30 | 60 | 90 | "custom";
  setDuration: (v: 30 | 60 | 90 | "custom") => void;
  customDays: string;
  setCustomDays: (v: string) => void;
  frequency: "daily" | "weekly";
  setFrequency: (v: "daily" | "weekly") => void;
  daysPerWeek: number;
  setDaysPerWeek: (n: number) => void;
}) {
  const durationOptions: { val: 30 | 60 | 90; sub: string }[] = [
    { val: 30, sub: "1 month" },
    { val: 60, sub: "2 months" },
    { val: 90, sub: "3 months" },
  ];

  return (
    <div>
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.02]">How long is your commitment?</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        We recommend 30 days for {goalLabel}.
      </p>

      {/* Duration cards */}
      <div className="mt-7 grid grid-cols-3 gap-3">
        {durationOptions.map((d) => {
          const selected = duration === d.val;
          return (
            <button
              key={d.val}
              onClick={() => setDuration(d.val)}
              className="rounded-2xl py-4 px-2 flex flex-col items-center justify-center transition"
              style={{
                background: selected ? PURPLE_SOFT : "white",
                border: selected ? `2px solid ${PURPLE}` : "1px solid #ECECEC",
              }}
            >
              <div className="text-[22px] font-bold" style={{ color: selected ? PURPLE : TEXT }}>
                {d.val} days
              </div>
              <div className="text-[13px] mt-1" style={{ color: TEXT_MUTED }}>
                {d.sub}
              </div>
              {d.val === 30 && (
                <div className="text-[13px] font-semibold mt-1" style={{ color: PURPLE }}>
                  Recommended
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom */}
      {duration === "custom" ? (
        <div
          className="mt-3 rounded-2xl px-5 py-4 flex items-center"
          style={{ background: PURPLE_SOFT, border: `2px solid ${PURPLE}` }}
        >
          <input
            autoFocus
            inputMode="numeric"
            placeholder="e.g. 45"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, ""))}
            className="flex-1 bg-transparent outline-none text-[17px]"
          />
          <span className="text-[15px]" style={{ color: TEXT_MUTED }}>
            days
          </span>
        </div>
      ) : (
        <button
          onClick={() => setDuration("custom")}
          className="mt-3 w-full rounded-2xl py-4 text-[15px]"
          style={{ border: "2px dashed #D6D3D1", color: TEXT_MUTED }}
        >
          Custom duration
        </button>
      )}

      {/* Frequency */}
      <div className="mt-7 text-[12px] font-semibold tracking-wider" style={{ color: LABEL }}>
        CHECK-IN FREQUENCY
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <FreqCard
          selected={frequency === "daily"}
          onClick={() => setFrequency("daily")}
          emoji="🔥"
          title="Every day"
          sub="Daily check-ins"
        />
        <FreqCard
          selected={frequency === "weekly"}
          onClick={() => setFrequency("weekly")}
          emoji="📅"
          title="Weekly"
          sub="Choose days/week"
        />
      </div>

      {frequency === "weekly" && (
        <>
          <div className="mt-6 text-[12px] font-semibold tracking-wider" style={{ color: LABEL }}>
            DAYS PER WEEK
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => {
              const selected = daysPerWeek === n;
              return (
                <button
                  key={n}
                  onClick={() => setDaysPerWeek(n)}
                  className="aspect-square rounded-xl text-[16px] font-semibold transition"
                  style={{
                    background: selected ? PURPLE_SOFT : "white",
                    border: selected ? `2px solid ${PURPLE}` : "1px solid #ECECEC",
                    color: selected ? PURPLE : TEXT,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FreqCard({
  selected,
  onClick,
  emoji,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl py-5 px-4 flex flex-col items-center justify-center transition"
      style={{
        background: selected ? PURPLE_SOFT : "white",
        border: selected ? `2px solid ${PURPLE}` : "1px solid #ECECEC",
      }}
    >
      <div className="text-[28px] leading-none">{emoji}</div>
      <div className="mt-2 text-[17px] font-bold">{title}</div>
      <div className="text-[13px] mt-0.5" style={{ color: TEXT_MUTED }}>
        {sub}
      </div>
    </button>
  );
}

/* ------------ Final Step ------------ */
function FinalStep({ onGo }: { onGo: () => void }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col justify-end relative overflow-hidden"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <img
        src={goodCompany.url}
        alt="Group of friends celebrating"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      <div className="relative px-6 pb-10 text-white">
        <h1
          className="text-[52px] leading-[0.98] tracking-tight"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          You're in good
          <br /> company.
        </h1>
        <p className="mt-5 text-[16px] leading-[1.5] text-white/85 max-w-[34ch]">
          Thousands of people are working on the same goal. Now you have a group behind you.
        </p>

        <button
          type="button"
          onClick={onGo}
          className="mt-7 w-full rounded-2xl py-5 flex items-center justify-center gap-2 text-[17px] font-semibold text-white"
          style={{
            background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
            boxShadow: "0 14px 34px -14px rgba(124, 58, 237, 0.55)",
          }}
        >
          Let's go <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
