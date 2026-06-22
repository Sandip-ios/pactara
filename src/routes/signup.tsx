import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  Camera,
  Check,
  Scale,
  Share2,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Star,
  Users,
} from "lucide-react";
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

type StepKey =
  | "name"
  | "email"
  | "photo"
  | "goal"
  | "company"
  | "group"
  | "commitment"
  | "invite"
  | "notify"
  | "password"
  | "paywall"
  | "starting"
  | "greeting"
  | "how";

const STEPS: StepKey[] = [
  "name",
  "email",
  "photo",
  "goal",
  "company",
  "group",
  "commitment",
  "invite",
  "notify",
  "password",
  "paywall",
  "starting",
  "greeting",
  "how",
];

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
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [sidePhoto, setSidePhoto] = useState<string | null>(null);
  const [startWeight, setStartWeight] = useState("");

  const step = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  const goalLabel = useMemo(() => GOALS.find((g) => g.id === goal)?.label ?? "your goal", [goal]);
  const goalEmoji = goal ? ICON_FOR_GOAL[goal] : "🎯";

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
  const finish = () => navigate({ to: "/" });

  const canContinue = (() => {
    switch (step) {
      case "name":
        return firstName.trim().length > 0 && lastName.trim().length > 0;
      case "email":
        return /\S+@\S+\.\S+/.test(email);
      case "photo":
        return true;
      case "goal":
        return goal !== null;
      case "group":
        return groupName.trim().length > 0;
      case "commitment":
        return duration !== "custom" || customDays.trim().length > 0;
      case "password":
        return password.length >= 8 && password === confirmPw;
      default:
        return true;
    }
  })();

  // Full-bleed screens
  if (step === "company") {
    return <CompanyStep onContinue={next} onBack={back} />;
  }
  if (step === "paywall") {
    return <PaywallStep onTrial={next} onFree={next} onBack={back} />;
  }
  if (step === "greeting") {
    return <GreetingStep firstName={firstName} onContinue={next} onBack={back} />;
  }
  if (step === "how") {
    return <HowItWorksStep onDone={finish} onBack={back} />;
  }

  return (
    <div
      className="h-[100dvh] w-full flex flex-col px-6 pb-8 overflow-hidden"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT, paddingTop: 32 }}
    >
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <button onClick={back} aria-label="Back" className="-ml-1 p-1 shrink-0">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: TRACK }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: PURPLE }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="mt-10 flex-1 flex flex-col min-h-0">
        {step === "name" && (
          <NameStep firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} />
        )}
        {step === "email" && <EmailStep firstName={firstName} email={email} setEmail={setEmail} />}
        {step === "photo" && <PhotoStep photo={photo} setPhoto={setPhoto} />}
        {step === "goal" && <GoalStep goal={goal} setGoal={setGoal} />}
        {step === "group" && (
          <GroupStep
            groupName={groupName}
            setGroupName={setGroupName}
            firstName={firstName}
            goalLabel={goalLabel}
            goalEmoji={goalEmoji}
          />
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
        {step === "invite" && <InviteStep />}
        {step === "notify" && <NotifyStep />}
        {step === "password" && (
          <PasswordStep
            password={password}
            setPassword={setPassword}
            confirmPw={confirmPw}
            setConfirmPw={setConfirmPw}
          />
        )}
        {step === "starting" && (
          <StartingPointStep
            frontPhoto={frontPhoto}
            setFrontPhoto={setFrontPhoto}
            sidePhoto={sidePhoto}
            setSidePhoto={setSidePhoto}
            startWeight={startWeight}
            setStartWeight={setStartWeight}
          />
        )}
      </div>

      {/* Footer actions */}
      <div className="flex flex-col items-center gap-3 pt-6">
        {step === "photo" && !photo ? (
          <>
            <PrimaryButton
              dimmed
              onClick={() => document.getElementById("photo-input")?.click()}
              label="Choose a photo first"
            />
            <button onClick={next} className="text-[15px] font-medium" style={{ color: TEXT_MUTED }}>
              Skip for now
            </button>
          </>
        ) : step === "invite" ? (
          <>
            <PrimaryButton onClick={next} label="Invite your people" icon={<Share2 size={18} />} />
            <div className="flex flex-col items-center gap-2 mt-auto pt-24 pb-2">
              <button onClick={next} className="text-[15px] font-medium underline" style={{ color: TEXT_MUTED }}>
                Skip for now
              </button>
              <p className="text-[13px] text-center" style={{ color: LABEL }}>
                You can invite people later from inside the app.
              </p>
            </div>
          </>
        ) : step === "notify" ? (
          <PrimaryButton onClick={next} label="Allow notifications" withArrow />
        ) : step === "starting" ? (
          <>
            <PrimaryButton onClick={next} label="Continue" />
            <button onClick={next} className="text-[15px] font-medium" style={{ color: TEXT_MUTED }}>
              Skip for now
            </button>
          </>
        ) : (
          <PrimaryButton disabled={!canContinue} onClick={next} label="Continue" withArrow />
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
  icon,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  withArrow?: boolean;
  dimmed?: boolean;
  icon?: ReactNode;
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
      {icon}
      {label}
      {withArrow && <ArrowRight size={20} />}
    </button>
  );
}

/* ------------ Field ------------ */
function Field({ label, children, error }: { label: string; children: ReactNode; error?: string | null }) {
  return (
    <div>
      <div
        className="rounded-2xl px-5 pt-4 pb-4"
        style={{
          background: INPUT_BG,
          border: error ? "1px solid #DC2626" : "1px solid transparent",
        }}
      >
        <div className="text-[12px] font-semibold tracking-wider" style={{ color: LABEL }}>
          {label}
        </div>
        <div className="mt-1.5">{children}</div>
      </div>
      {error && (
        <div className="mt-1.5 ml-1 text-[13px]" style={{ color: "#DC2626" }} role="alert">
          {error}
        </div>
      )}
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
  const [touched, setTouched] = useState(false);
  const [touchedLast, setTouchedLast] = useState(false);
  const firstError = touched && firstName.trim().length === 0 ? "Add your first name so your group knows who you are" : null;
  const lastError = touchedLast && lastName.trim().length === 0 ? "Add your last name so your group knows who you are" : null;
  return (
    <div>
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.05]">What's your name?</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        This is how your group will know you.
      </p>
      <div className="mt-7 flex flex-col gap-4">
        <Field label="FIRST NAME" error={firstError}>
          <input
            className={inputClass}
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={() => setTouched(true)}
            autoFocus
            aria-invalid={!!firstError}
          />
        </Field>
        <Field label="LAST NAME" error={lastError}>
          <input
            className={inputClass}
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onBlur={() => setTouchedLast(true)}
            aria-invalid={!!lastError}
          />
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
  const [touched, setTouched] = useState(false);
  const error = touched
    ? email.trim().length === 0
      ? "We need your email to log you in"
      : !/\S+@\S+\.\S+/.test(email)
        ? "Hmm, that email looks off — check for a missing @ or .com"
        : null
    : null;
  return (
    <div>
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">
        What's your email{firstName ? `, ${firstName}` : ""}?
      </h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        You'll use this to log in and receive important updates.
      </p>
      <div className="mt-7">
        <Field label="EMAIL ADDRESS" error={error}>
          <input
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            autoFocus
            aria-invalid={!!error}
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
    <div className="flex-1 flex flex-col min-h-0">
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.05]">Add a profile photo</h1>
      <p className="mt-3 text-[16px] leading-[1.45]" style={{ color: TEXT_MUTED }}>
        Groups with photos are 3× more likely to stay accountable.
      </p>

      <div className="flex-1 flex items-center justify-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-[240px] h-[240px] rounded-full flex items-center justify-center"
          style={{ background: PURPLE_SOFT }}
        >
          <div className="absolute inset-3 rounded-full" style={{ border: `2px dashed ${PURPLE_BORDER}` }} />
          {photo ? (
            <img src={photo} alt="Profile" className="w-full h-full object-cover rounded-full" />
          ) : (
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="9" r="3.5" fill={PURPLE_BORDER} />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill={PURPLE_BORDER} />
            </svg>
          )}
          <div
            className="absolute right-3 bottom-3 w-12 h-12 rounded-full flex items-center justify-center text-white"
            style={{ background: PURPLE, border: "4px solid white", boxShadow: "0 6px 16px -6px rgba(124,58,237,0.55)" }}
          >
            <Camera size={20} />
          </div>
        </button>
        <input id="photo-input" ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
    </div>
  );
}

/* ------------ Step: Goal ------------ */
function GoalStep({ goal, setGoal }: { goal: string | null; setGoal: (v: string) => void }) {
  return (
    <div className="h-full flex flex-col min-h-0">
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">What's your fitness goal?</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        Your group will train toward this together.
      </p>

      <div className="mt-6 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2 -mx-6 px-6">
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

/* ------------ Step: Good Company (interstitial) ------------ */
function CompanyStep({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <img src={goodCompany.url} alt="Group of friends celebrating" className="absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.9) 100%)" }}
      />

      <div className="relative px-6 pt-14">
        <button onClick={onBack} aria-label="Back" className="-ml-1 p-1 text-white/90">
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="flex-1" />

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
          onClick={onContinue}
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

      <GroupNameField groupName={groupName} setGroupName={setGroupName} goalLabel={goalLabel} goalEmoji={goalEmoji} />
    </div>
  );
}

function GroupNameField({
  groupName,
  setGroupName,
  goalLabel,
  goalEmoji,
}: {
  groupName: string;
  setGroupName: (v: string) => void;
  goalLabel: string;
  goalEmoji: string;
}) {
  const [touched, setTouched] = useState(false);
  const error = touched && groupName.trim().length === 0 ? "Give your group a name your friends will recognize" : null;
  return (
    <div className="mt-5">
      <Field label="GROUP NAME" error={error}>
        <div className="flex items-center gap-2">
          <span className="text-[18px]">{goalEmoji}</span>
          <input
            className={inputClass}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={`${goalLabel} Crew`}
            autoFocus
            aria-invalid={!!error}
          />
        </div>
      </Field>
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

      {duration === "custom" ? (
        <div className="mt-3 rounded-2xl px-5 py-4 flex items-center" style={{ background: PURPLE_SOFT, border: `2px solid ${PURPLE}` }}>
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

      <div className="mt-7 text-[12px] font-semibold tracking-wider" style={{ color: LABEL }}>
        CHECK-IN FREQUENCY
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <FreqCard selected={frequency === "daily"} onClick={() => setFrequency("daily")} emoji="🔥" title="Every day" sub="Daily check-ins" />
        <FreqCard selected={frequency === "weekly"} onClick={() => setFrequency("weekly")} emoji="📅" title="Weekly" sub="Choose days/week" />
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

/* ------------ Step: Invite ------------ */
function InviteStep() {
  return (
    <div className="flex flex-col items-center text-center pt-10">
      <div
        className="w-[88px] h-[88px] rounded-[22px] flex items-center justify-center"
        style={{ background: PURPLE_SOFT }}
      >
        <Users size={40} color="#475569" strokeWidth={1.8} />
      </div>
      <h1 className="mt-7 text-[36px] font-bold tracking-tight leading-[1.05]">
        Invite your accountability crew
      </h1>
      <p className="mt-4 text-[16px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
        People who check in with a group are
        <br />
        3× more likely to reach their goal.
      </p>
    </div>
  );
}

/* ------------ Step: Notify ------------ */
function NotifyStep() {
  return (
    <div>
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">
        Know the moment your group checks in
      </h1>
      <p className="mt-4 text-[16px] leading-[1.5] text-center max-w-[36ch] mx-auto" style={{ color: TEXT_MUTED }}>
        Real accountability happens in real time — don't miss a beat
      </p>

      <div
        className="mt-12 rounded-2xl overflow-hidden mx-auto max-w-[340px]"
        style={{ background: "#F2F2F2", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.25)" }}
      >
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="text-[17px] font-semibold">"Pactara" Would Like to Send You Notifications</div>
          <div className="mt-3 text-[14px] leading-[1.45]" style={{ color: "#3A3A3A" }}>
            Get notified when your group checks in, hits a streak, or needs a nudge. You can change this in Settings anytime.
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-black/10">
          <div className="py-3.5 text-center text-[15px]" style={{ color: "#3A3A3A" }}>
            Don't Allow
          </div>
          <div className="py-3.5 text-center text-[16px] font-semibold border-l border-black/10" style={{ background: "#DDEBFB", color: "#0A84FF" }}>
            Allow
          </div>
        </div>
      </div>
      <div className="mt-2 mx-auto max-w-[340px] flex">
        <div className="w-1/2" />
        <div className="w-1/2 text-center text-[28px]">👆</div>
      </div>
    </div>
  );
}

/* ------------ Step: Password ------------ */
function PasswordStep({
  password,
  setPassword,
  confirmPw,
  setConfirmPw,
}: {
  password: string;
  setPassword: (v: string) => void;
  confirmPw: string;
  setConfirmPw: (v: string) => void;
}) {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [touched1, setTouched1] = useState(false);
  const [touched2, setTouched2] = useState(false);
  const pwError = touched1 && password.length > 0 && password.length < 8 ? "A few more characters — aim for 8 or more" : touched1 && password.length === 0 ? "Set a password to keep your account secure" : null;
  const confirmError = touched2 && confirmPw.length > 0 && confirmPw !== password ? "These don't match yet — try retyping" : null;
  return (
    <div>
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.05]">
        Create a password <span aria-hidden>🔒</span>
      </h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        You'll use this to log in. At least 8 characters.
      </p>

      <div className="mt-7 flex flex-col gap-4">
        <Field label="PASSWORD" error={pwError}>
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              type={show1 ? "text" : "password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched1(true)}
              autoFocus
              aria-invalid={!!pwError}
            />
            <button type="button" onClick={() => setShow1((s) => !s)} className="text-stone-500">
              {show1 ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </Field>
        <Field label="CONFIRM PASSWORD" error={confirmError}>
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              type={show2 ? "text" : "password"}
              placeholder="Repeat your password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              onBlur={() => setTouched2(true)}
              aria-invalid={!!confirmError}
            />
            <button type="button" onClick={() => setShow2((s) => !s)} className="text-stone-500">
              {show2 ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </Field>
      </div>
    </div>
  );
}

/* ------------ Step: Paywall ------------ */
function PaywallStep({
  onTrial,
  onFree,
  onBack,
}: {
  onTrial: () => void;
  onFree: () => void;
  onBack: () => void;
}) {
  const bullets = [
    { emoji: "🏁", text: "Finally finish what you start — your group keeps you going" },
    { emoji: "📈", text: "See real progress, week over week, not just intentions" },
    { emoji: "💪", text: "Build the habit that changes everything — one day at a time" },
  ];
  return (
    <div
      className="min-h-screen w-full flex flex-col px-6 pt-14 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT }}
    >
      <div className="mt-2">
        <button onClick={onBack} aria-label="Back" className="-ml-1 p-1">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="mt-2 flex flex-col items-center text-center">
        <div
          className="w-[120px] h-[120px] rounded-[28px] flex items-center justify-center"
          style={{ background: PURPLE_SOFT, boxShadow: "0 20px 40px -20px rgba(124,58,237,0.4)" }}
        >
          <div
            className="w-[88px] h-[88px] rounded-[20px] flex items-center justify-center text-[44px]"
            style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
          >
            🔥
          </div>
        </div>
        <h1 className="mt-6 text-[36px] font-bold tracking-tight leading-[1.05]">
          This is the year
          <br /> you actually do it.
        </h1>
        <p className="mt-4 text-[15px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
          People who check in with a group are 3× more
          <br /> likely to reach their goal. Try it free for 7 days.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {bullets.map((b) => (
          <div key={b.text} className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] shrink-0"
              style={{ background: PURPLE_SOFT }}
            >
              {b.emoji}
            </div>
            <div className="text-[15px] leading-[1.45] pt-1">{b.text}</div>
          </div>
        ))}
      </div>

      <div className="mt-7 rounded-2xl px-5 py-4" style={{ background: PURPLE_SOFT }}>
        <div className="flex gap-0.5 text-[#F5B400]">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} fill="#F5B400" stroke="#F5B400" />
          ))}
        </div>
        <p className="mt-2 text-[15px] italic leading-[1.45]">
          "I've tried everything. Pactara is the first thing that actually worked. I lost 18 lbs and I'm still going."
        </p>
        <p className="mt-3 text-[14px] font-semibold" style={{ color: PURPLE }}>
          — Marcus, down 18 lbs in 60 days
        </p>
      </div>

      <div className="mt-7 flex flex-col items-center gap-3">
        <PrimaryButton onClick={onTrial} label="Start free 7-day trial" withArrow />
        <div className="text-[13px]" style={{ color: TEXT_MUTED }}>
          Then $9.99/mo · Cancel anytime before Day 8
        </div>
        <button onClick={onFree} className="mt-1 text-[15px] font-medium" style={{ color: PURPLE }}>
          No thanks, continue with Free plan
        </button>
      </div>
    </div>
  );
}

/* ------------ Step: Starting Point ------------ */
function StartingPointStep({
  frontPhoto,
  setFrontPhoto,
  sidePhoto,
  setSidePhoto,
  startWeight,
  setStartWeight,
}: {
  frontPhoto: string | null;
  setFrontPhoto: (v: string | null) => void;
  sidePhoto: string | null;
  setSidePhoto: (v: string | null) => void;
  startWeight: string;
  setStartWeight: (v: string) => void;
}) {
  return (
    <div>
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">Capture your starting point</h1>
      <p className="mt-3 text-[15px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
        Completely private — only you can see this. You'll be amazed when you look back.
      </p>
      <p className="mt-3 text-[14px]" style={{ color: LABEL }}>
        Full body works best — front and side angles tell the real story.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <PhotoSlot label="Front" photo={frontPhoto} setPhoto={setFrontPhoto} />
        <PhotoSlot label="Side" photo={sidePhoto} setPhoto={setSidePhoto} />
      </div>

      <button className="mt-4 flex items-center gap-2 text-[15px] font-semibold" style={{ color: PURPLE }}>
        <Plus size={18} /> Add another angle
      </button>

      <div className="mt-7">
        <div className="text-[15px] font-semibold">
          Starting weight <span className="font-normal" style={{ color: TEXT_MUTED }}>(optional)</span>
        </div>
        <div className="mt-2 rounded-2xl px-5 py-4 flex items-center" style={{ border: "1px solid #ECECEC" }}>
          <input
            inputMode="decimal"
            placeholder="185"
            value={startWeight}
            onChange={(e) => setStartWeight(e.target.value.replace(/[^\d.]/g, ""))}
            className="flex-1 bg-transparent outline-none text-[17px]"
          />
          <span className="text-[15px]" style={{ color: TEXT_MUTED }}>
            lbs
          </span>
        </div>
        <div className="mt-3 flex items-start gap-2 text-[13px] leading-[1.45]" style={{ color: LABEL }}>
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>Your group will never see this. At the end of your challenge, you can choose to share your transformation.</span>
        </div>
      </div>
    </div>
  );
}

function PhotoSlot({
  label,
  photo,
  setPhoto,
}: {
  label: string;
  photo: string | null;
  setPhoto: (v: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(URL.createObjectURL(f));
  };
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full aspect-[4/5] rounded-2xl flex flex-col items-center justify-center overflow-hidden"
        style={{ border: "2px dashed #D6D3D1" }}
      >
        {photo ? (
          <img src={photo} alt={label} className="w-full h-full object-cover" />
        ) : (
          <>
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ border: "1.5px solid #B8B3AD", color: "#9A958E" }}
            >
              <Plus size={20} />
            </div>
            <div className="mt-2 text-[14px]" style={{ color: TEXT_MUTED }}>
              Add photo
            </div>
          </>
        )}
      </button>
      <div className="mt-2 text-[14px] italic" style={{ color: TEXT_MUTED }}>
        {label}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </div>
  );
}

/* ------------ Step: Greeting (Jose, you're in) ------------ */
function GreetingStep({ firstName, onContinue, onBack }: { firstName: string; onContinue: () => void; onBack: () => void }) {
  const name = firstName || "friend";
  return (
    <div
      className="min-h-screen w-full flex flex-col px-6 pt-14 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT }}
    >
      <button onClick={onBack} aria-label="Back" className="-ml-1 p-1 mt-2 w-fit">
        <ChevronLeft size={22} />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-[64px]">👋</div>
        <h1
          className="mt-6 text-[56px] leading-[0.95] tracking-tight"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          You're in,
          <br /> {name}.
        </h1>
        <p className="mt-5 text-[16px] leading-[1.5] max-w-[34ch]" style={{ color: TEXT_MUTED }}>
          Your group is set up and your commitment is locked in. Let's show you how this works.
        </p>
      </div>

      <PrimaryButton onClick={onContinue} label="Continue" withArrow />
    </div>
  );
}

/* ------------ Step: How it works ------------ */
function HowItWorksStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const steps = [
    {
      n: "1",
      emoji: "✅",
      title: "Check in every day",
      text: "Open the app, share a quick photo or note. Your group sees you showed up.",
    },
    {
      n: "2",
      emoji: "👀",
      title: "See your group in real time",
      text: "Watch the streak grow as your crew checks in alongside you.",
    },
    {
      n: "3",
      emoji: "🏆",
      title: "Finish what you started",
      text: "Hit your commitment together. Celebrate the transformation.",
    },
  ];
  return (
    <div
      className="min-h-screen w-full flex flex-col px-6 pt-14 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT }}
    >
      <button onClick={onBack} aria-label="Back" className="-ml-1 p-1 mt-2 w-fit">
        <ChevronLeft size={22} />
      </button>

      <h1 className="mt-6 text-[40px] font-bold tracking-tight leading-[1.05]">Here's how it works</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        Three simple steps. Every single day.
      </p>

      <div className="mt-8 flex-1 flex flex-col gap-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-2xl p-5 flex items-start gap-4"
            style={{ background: PURPLE_SOFT }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[18px] font-bold shrink-0"
              style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
            >
              {s.n}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[20px]">{s.emoji}</span>
                <div className="text-[17px] font-semibold">{s.title}</div>
              </div>
              <p className="mt-1.5 text-[14px] leading-[1.45]" style={{ color: TEXT_MUTED }}>
                {s.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <PrimaryButton onClick={onDone} label="Let's go" withArrow />
    </div>
  );
}
