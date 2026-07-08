import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Focuses an input on mount, but only on the client AFTER React has hydrated.
 * Using the `autoFocus` prop causes SSR to emit `autofocus=""` on the input,
 * so the browser focuses it before hydration — characters typed during that
 * window land in an uncontrolled DOM input and get wiped (and the keyboard
 * dismissed) the moment React hydrates and forces `value=""`.
 */
function useClientAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
import {
  ArrowRight,
  ChevronLeft,
  Camera,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock,
  CreditCard,
  Link2,
  Scale,
  Share2,
  Eye,
  EyeOff,
  Plus,
  Star,
  Users,
  X,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

import { supabase } from "@/integrations/supabase/client";
import { createGroupForUser, setMyName } from "@/lib/groups.functions";
import { setAvatarPath } from "@/lib/profile.functions";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Pactara account" },
      { name: "description", content: "Set up your group and start your commitment." },
    ],
  }),
  component: SignupFlow,
});

export const PURPLE = "#7C3AED";
export const PURPLE_DEEP = "#5B21B6";
export const PURPLE_SOFT = "#F3EEFF";
const PURPLE_BORDER = "#C9B8FF";
const INPUT_BG = "#EFEDEA";
const LABEL = "#8A8580";
const TEXT_MUTED = "#6B6660";
const TEXT = "#0A0A0A";
const TRACK = "#EAE4F5";

export const GOALS = [
  { id: "lose-weight", emoji: "⚖️", label: "Lose weight", blurb: "Track food, move daily, and build the habits that stick" },
  { id: "build-muscle", emoji: "💪", label: "Build muscle", blurb: "Progressive lifting with your crew keeping you honest" },
  { id: "run", emoji: "🏃", label: "Run consistently", blurb: "Lace up together, week after week" },
  { id: "eat-better", emoji: "🥗", label: "Eat better", blurb: "Whole foods, real meals, shared wins" },
  { id: "race", emoji: "🏅", label: "Train for a race", blurb: "Show up to the start line ready" },
  { id: "general", emoji: "🔥", label: "General fitness", blurb: "Move every day. Feel better. Together." },
  { id: "75-hard", emoji: "🪖", label: "75 Hard", blurb: "The full program. No compromises." },
  { id: "custom", emoji: "🎯", label: "Something else", blurb: "Set your own goal in your own words" },
];


export const ICON_FOR_GOAL: Record<string, string> = {
  "lose-weight": "⚖️",
  "build-muscle": "💪",
  run: "🏃",
  "eat-better": "🥗",
  race: "🏅",
  general: "🔥",
  "75-hard": "🪖",
  custom: "🎯",
};

type StepKey =
  | "name"
  | "email"
  | "photo"
  | "goal"
  | "consistency"

  | "commitment"
  | "group"
  | "company"
  | "invite"
  | "notify"
  | "password"
  | "greeting";

const STEPS: StepKey[] = [
  "name",
  "email",
  "photo",
  "goal",
  "consistency",
  
  "commitment",
  "group",
  "company",
  "invite",
  "notify",
  "password",
  "greeting",
];




function SignupFlow() {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);


  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [customGoalLabel, setCustomGoalLabel] = useState("");
  
  const [groupName, setGroupName] = useState("");
  const [duration, setDuration] = useState<30 | 60 | 90 | "custom">(30);
  const [customDays, setCustomDays] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const step = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  const goalLabel = useMemo(() => {
    if (goal === "custom") return customGoalLabel.trim() || "your goal";
    return GOALS.find((g) => g.id === goal)?.label ?? "your goal";
  }, [goal, customGoalLabel]);
  const goalEmoji = goal ? ICON_FOR_GOAL[goal] : "🎯";

  const ensureGroupName = () => {
    if (!groupName && goal) {
      const seed = goal === "custom" ? (customGoalLabel.trim() || "My") : GOALS.find((x) => x.id === goal)!.label;
      setGroupName(`${seed} Crew`);
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

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const finish = async () => {
    if (finishing) return;
    setFinishError(null);
    setFinishing(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      // Sign up (or sign in if the account already exists for this email).
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: fullName } },
        });
        if (error) throw error;
        session = data.session;
        if (!session) {
          // Auto-confirm is on but in case it's off, try sign in.
          const signIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (signIn.error) throw signIn.error;
          session = signIn.data.session;
        }
      }
      await setMyName({ data: { name: fullName } });
      if (photoFile && session?.user) {
        try {
          const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("avatars")
            .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
          if (!upErr) await setAvatarPath({ data: { path } });
        } catch (err) {
          console.error("Avatar upload during signup failed", err);
        }
      }
      const pendingInvite =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("pending-invite-group")
          : null;
      if (pendingInvite) {
        const { joinGroupById } = await import("@/lib/groups.functions");
        await joinGroupById({ data: { groupId: pendingInvite } });
        sessionStorage.removeItem("pending-invite-group");
        if (typeof localStorage !== "undefined") localStorage.setItem("active-group-id", pendingInvite);
      } else {
        const finalGroupName = groupName.trim() || `${goalLabel} Crew`;
        const durationDays =
          goal === "75-hard"
            ? 75
            : duration === "custom"
              ? Math.max(1, Math.min(365, parseInt(customDays, 10) || 30))
              : duration;
        await createGroupForUser({
          data: {
            name: finalGroupName,
            emoji: goalEmoji,
            durationDays,
            frequency: frequency === "weekly" ? "specific" : "daily",
            daysPerWeek,
          },
        });
      }
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("invite-dismissed");
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("show-welcome", "1");
      navigate({ to: "/home" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setFinishError(msg);
      setFinishing(false);
    }
  };

  const canContinue = (() => {
    switch (step) {
      case "name":
        return firstName.trim().length > 0 && lastName.trim().length > 0;
      case "email":
        return /\S+@\S+\.\S+/.test(email);
      case "photo":
        return true;
      case "goal":
        if (goal === "custom") return customGoalLabel.trim().length > 0;
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
    return <CompanyStep onContinue={next} onBack={back} progress={progress} />;
  }

  if (step === "consistency") {
    return <ConsistencyStep onContinue={next} onBack={back} progress={progress} />;
  }


  if (step === "greeting") {
    const days =
      goal === "75-hard"
        ? 75
        : duration === "custom"
          ? parseInt(customDays, 10) || 30
          : duration;
    const frequencyLabel = frequency === "daily" ? "Every day" : `${daysPerWeek}× per week`;
    return (
      <>
        <GreetingStep
          firstName={firstName}
          days={days}
          goalLabel={goalLabel}
          goalEmoji={goalEmoji}
          frequencyLabel={frequencyLabel}
          onContinue={finish}
          onBack={back}
        />
        {finishing && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl px-6 py-5 text-[15px] font-medium">Creating your account…</div>
          </div>
        )}
        {finishError && (
          <div className="fixed bottom-6 inset-x-6 z-50 rounded-xl bg-red-600 text-white px-4 py-3 text-[14px]" role="alert">
            {finishError}
          </div>
        )}
      </>
    );
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
      <div className="mt-10 flex-1 flex flex-col min-h-0 overflow-y-auto">
        {step === "name" && (
          <NameStep firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} />
        )}
        {step === "email" && <EmailStep firstName={firstName} email={email} setEmail={setEmail} />}
        {step === "photo" && <PhotoStep photo={photo} setPhoto={setPhoto} setPhotoFile={setPhotoFile} />}
        {step === "goal" && (
          <GoalStep
            goal={goal}
            setGoal={setGoal}
            customGoalLabel={customGoalLabel}
            setCustomGoalLabel={setCustomGoalLabel}
          />
        )}


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
            goalId={goal}
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
        {step === "notify" && <NotifyStep onAllow={next} />}
        {step === "password" && (
          <PasswordStep
            password={password}
            setPassword={setPassword}
            confirmPw={confirmPw}
            setConfirmPw={setConfirmPw}
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
            <PrimaryButton onClick={next} label="Invite your friends" icon={<Link2 size={18} />} />
            <div className="flex flex-col items-center gap-2 mt-auto pt-24 pb-2">
              <button onClick={next} className="text-[15px] font-medium underline" style={{ color: TEXT_MUTED }}>
                Skip for now
              </button>
              <p className="text-[13px] text-center" style={{ color: LABEL }}>
                You can invite people later, but they'll join the challenge already in progress.
              </p>
            </div>
          </>
        ) : step === "notify" ? null : (
          <PrimaryButton disabled={!canContinue} onClick={next} label="Continue" withArrow />
        )}
      </div>
    </div>
  );
}

/* ------------ Primary Button ------------ */
export function PrimaryButton({
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
  const firstRef = useClientAutoFocus<HTMLInputElement>();
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
            ref={firstRef}
            className={inputClass}
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={() => setTouched(true)}
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
function PhotoStep({ photo, setPhoto, setPhotoFile }: { photo: string | null; setPhoto: (v: string | null) => void; setPhotoFile: (f: File | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
    setPhotoFile(file);
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
export function GoalStep({
  goal,
  setGoal,
  customGoalLabel = "",
  setCustomGoalLabel,
}: {
  goal: string | null;
  setGoal: (v: string) => void;
  customGoalLabel?: string;
  setCustomGoalLabel?: (v: string) => void;
}) {
  return (
    <div className="h-full flex flex-col min-h-0">
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">What's your challenge?</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        Pick what your group will work toward together.
      </p>

      <div className="mt-6 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2 -mx-6 px-6">
        {GOALS.map((g) => {
          const selected = goal === g.id;
          const isCustom = g.id === "custom";
          const dashed = isCustom && !selected;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className="w-full rounded-2xl px-4 py-4 flex items-start gap-3 text-left transition"
              style={{
                background: selected ? "#FFF4ED" : isCustom ? "#FFFFFF" : INPUT_BG,
                border: selected
                  ? "2px solid #F97316"
                  : dashed
                    ? "2px dashed #C9C4BE"
                    : "2px solid transparent",
                boxShadow: selected ? "0 10px 24px -16px rgba(249,115,22,0.4)" : "none",
              }}
            >
              <span className="text-[22px] leading-none mt-0.5">
                {isCustom && !selected ? <Plus size={22} color={TEXT_MUTED} /> : g.emoji}
              </span>
              <div className="flex-1">
                <div className="text-[17px] font-semibold">
                  {isCustom && !selected ? "Add your own goal" : g.label}
                </div>
                {selected ? (
                  <div className="mt-1 text-[14px] leading-[1.4]" style={{ color: TEXT_MUTED }}>
                    {g.blurb}
                  </div>
                ) : isCustom ? (
                  <div className="mt-1 text-[14px] leading-[1.4]" style={{ color: TEXT_MUTED }}>
                    Something not on the list? Name it yourself.
                  </div>
                ) : null}
                {selected && isCustom && setCustomGoalLabel && (
                  <input
                    autoFocus
                    type="text"
                    value={customGoalLabel}
                    onChange={(e) => setCustomGoalLabel(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="e.g. Work out 3x a week"
                    maxLength={40}
                    className="mt-3 w-full rounded-xl px-3 py-3 text-[15px] outline-none"
                    style={{ background: "#FFFFFF", border: "1px solid #F97316" }}
                  />
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

/* ------------ Step: Social Proof (interstitial) ------------ */
export function CompanyStep({ onContinue, onBack, progress }: { onContinue: () => void; onBack: () => void; progress: number }) {
  const reviews = [
    {
      name: "Marcus",
      date: "June 28, 2026",
      stars: 5,
      text: "Been trying to stay consistent with workouts for years. Something about my group seeing when I miss a day just… works. Two weeks in and I haven't skipped once.",
    },
    {
      name: "Priya",
      date: "July 1, 2026",
      stars: 4,
      text: "Really solid app. Wish there were a few more filter options for the check-in videos, but the group accountability piece is exactly what I needed.",
    },
    {
      name: "DJ",
      date: "July 4, 2026",
      stars: 5,
      text: "My roommate and I started a group as a joke and now we're both 3 weeks into actually working out consistently for the first time ever. Didn't expect that.",
    },
  ];

  const Stars = ({ count = 5 }: { count?: number }) => (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < count;
        return (
          <Star
            key={i}
            size={16}
            fill={filled ? "#E9B949" : "none"}
            stroke={filled ? "#E9B949" : "#D6D0C4"}
          />
        );
      })}
    </div>
  );



  const Laurel = ({ flip = false }: { flip?: boolean }) => (
    <svg
      width="34"
      height="52"
      viewBox="0 0 34 52"
      fill="none"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
      aria-hidden
    >
      <path
        d="M28 4 C 18 10, 12 20, 10 32 C 9 40, 12 46, 18 50"
        stroke="#C9A24A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {[
        [22, 10],
        [18, 16],
        [14, 22],
        [11, 29],
        [10, 36],
        [12, 43],
      ].map(([cx, cy], i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx="4.5"
          ry="2"
          fill="#C9A24A"
          transform={`rotate(${-45 + i * 8} ${cx} ${cy})`}
        />
      ))}
    </svg>
  );

  return (
    <div
      className="h-[100dvh] w-full flex flex-col px-6 pb-8 overflow-hidden"
      style={{
        background: "#FFFFFF",
        fontFamily: "Inter, system-ui, sans-serif",
        color: TEXT,
        paddingTop: 32,
      }}
    >
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="-ml-1 p-1 shrink-0">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: TRACK }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: PURPLE }}
          />
        </div>
      </div>

      <div className="mt-10 flex-1 flex flex-col min-h-0 overflow-y-auto">
        <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">
          What early members are saying
        </h1>

        <div className="mt-8 space-y-4 pb-4">

          {reviews.map((r, i) => (
            <div
              key={i}
              className="rounded-2xl p-4"
              style={{ background: "#F1EEF7" }}
            >
              <div className="flex items-center justify-between">
                <Stars count={r.stars} />
                <div className="text-[13px] text-[#6B6660]">
                  {r.name}, {r.date}
                </div>
              </div>
              <p className="mt-3 text-[15px] leading-[1.45] text-black">{r.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 pt-6">
        <PrimaryButton onClick={onContinue} label="Continue" withArrow />
      </div>
    </div>
  );
}


/* ------------ Step: Group ------------ */
export function GroupStep({
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
export function CommitmentStep({
  goalLabel,
  goalId,
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
  goalId: string | null;
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

  const is75Hard = goalId === "75-hard";

  if (is75Hard) {
    return (
      <div>
        <h1 className="text-[40px] font-bold tracking-tight leading-[1.02]">How long is your challenge?</h1>
        <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
          75 Hard is a fixed 75-day program. The length is set for you.
        </p>

        <div className="mt-7 rounded-2xl px-5 py-6 flex items-center gap-4" style={{ background: PURPLE_SOFT, border: `2px solid ${PURPLE}` }}>
          <div className="text-[32px]">🪖</div>
          <div className="flex-1">
            <div className="text-[24px] font-bold" style={{ color: PURPLE }}>75 days</div>
            <div className="text-[13px] mt-1" style={{ color: TEXT_MUTED }}>Locked in for the 75 Hard program</div>
          </div>
        </div>

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

  return (
    <div>
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.02]">How long is your challenge?</h1>
      <p className="mt-3 text-[16px]" style={{ color: TEXT_MUTED }}>
        We recommend 30 days to build a lasting habit.
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
export function InviteStep() {
  return (
    <div className="flex flex-col items-center text-center pt-10">
      <div
        className="w-[88px] h-[88px] rounded-[22px] flex items-center justify-center"
        style={{ background: PURPLE_SOFT }}
      >
        <Users size={40} color="#475569" strokeWidth={1.8} />
      </div>
      <h1 className="mt-7 text-[36px] font-bold tracking-tight leading-[1.05]">
        Invite your crew
      </h1>
      <p className="mt-4 text-[16px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
        Your challenge starts today. Invite your friends now so they don't miss Day 1.
      </p>
    </div>
  );
}

/* ------------ Step: Notify ------------ */
export function NotifyStep({ onAllow }: { onAllow: () => void }) {
  const handleAllow = async () => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        await Notification.requestPermission();
      }
    } catch {
      // ignore — proceed regardless of permission outcome
    }
    onAllow();
  };

  return (
    <div>
      <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">
        Know the moment your group checks in
      </h1>
      <p className="mt-4 text-[16px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
        Real accountability happens in real time — don't miss a beat
      </p>

      <div
        className="mt-12 rounded-2xl overflow-hidden mx-auto max-w-[340px]"
        style={{ background: "#F2F2F2", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.25)" }}
      >
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="text-[17px] font-semibold">"Pactara" Would Like to Send You Notifications</div>
          <div className="mt-3 text-[14px] leading-[1.45]" style={{ color: "#3A3A3A" }}>
            Get notified when someone in your group checks in, plus reminders to make your morning commitment and check in yourself. You can change this in Settings anytime.
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-black/10">
          <div className="py-3.5 text-center text-[15px]" style={{ color: "#3A3A3A" }}>
            Don't Allow
          </div>
          <button
            type="button"
            onClick={handleAllow}
            className="py-3.5 text-center text-[16px] font-semibold border-l border-black/10 active:opacity-80"
            style={{ background: "#DDEBFB", color: "#0A84FF" }}
          >
            Allow
          </button>
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
        Create a password
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

/* ------------ Page: All Plans ------------ */
function PlansPage({ onSelect, onBack }: { onSelect: () => void; onBack: () => void }) {
  const BG = "#F5F2EC";
  const INK = "#13131F";
  const MUTED = "#5A5A66";
  const ORANGE = "#C2410C";
  const SERIF = "'Instrument Serif', 'Cormorant Garamond', Georgia, serif";

  const features = [
    { label: "Free trial", monthly: "7 days", annual: "7 days" },
    { label: "Daily check-ins", monthly: true, annual: true },
    { label: "Photo check-ins", monthly: true, annual: true },
    { label: "Unlimited groups", monthly: true, annual: true },
    { label: "Streak freezes to start", monthly: "2", annual: "2" },
    { label: "Back-to-back challenges", monthly: false, annual: true },
    { label: "Early feature access", monthly: false, annual: true },
  ] as const;

  const Cell = ({ v }: { v: boolean | string }) => {
    if (typeof v === "string") {
      return <span className="text-[14px]" style={{ color: INK }}>{v}</span>;
    }
    if (v) return <Check size={20} strokeWidth={2.5} style={{ color: ORANGE }} />;
    return <span style={{ color: "#C9C9D1" }}>—</span>;
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="px-6 pt-6 pb-10 max-w-[480px] mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} aria-label="Back" className="p-1 -ml-1">
            <ChevronLeft size={26} style={{ color: INK }} />
          </button>
          <div className="text-[17px] font-semibold" style={{ color: INK }}>Plans</div>
        </div>

        <div className="text-[12px] font-bold tracking-[0.12em]" style={{ color: PURPLE }}>
          PACTARA PREMIUM
        </div>
        <h1 className="mt-2 text-[34px] leading-[1.05] tracking-tight" style={{ fontFamily: SERIF, color: INK }}>
          Pick what fits your pace.
        </h1>
        <p className="mt-3 text-[15px] leading-[1.45]" style={{ color: MUTED }}>
          Both plans start with the same 7-day free trial. Switch or cancel anytime in Settings.
        </p>

        {/* Monthly Card */}
        <div className="mt-8 rounded-[22px] bg-white p-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <span className="text-[24px]">🔥</span>
            <span className="text-[24px] font-semibold tracking-tight" style={{ fontFamily: SERIF, color: INK }}>Monthly</span>
          </div>
          <p className="mt-2 text-[15px]" style={{ color: MUTED }}>Unlimited groups. Cancel anytime.</p>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-[44px] leading-none" style={{ fontFamily: SERIF, color: INK }}>$12.99</span>
            <span className="text-[16px]" style={{ color: MUTED }}>/ month</span>
          </div>
          <p className="mt-2 text-[14px]" style={{ color: MUTED }}>Starts with your 7-day free trial</p>
          <ul className="mt-5 space-y-3">
            {["Unlimited groups", "Daily & photo check-ins", "2 streak freezes to start"].map((f) => (
              <li key={f} className="flex items-center gap-3 text-[15px]" style={{ color: INK }}>
                <Check size={18} strokeWidth={2.5} style={{ color: "#9A9AA5" }} />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={onSelect}
            className="mt-6 w-full rounded-full py-4 text-[16px] font-semibold"
            style={{ background: "#F1EEE8", color: INK }}
          >
            Start free trial — Monthly
          </button>
        </div>

        {/* Annual Card */}
        <div className="mt-6 relative rounded-[22px] bg-white p-6" style={{ border: `2px solid ${ORANGE}` }}>
          <div
            className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[12px] font-semibold text-white"
            style={{ background: ORANGE }}
          >
            Save 48%
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[24px]">⚡</span>
            <span className="text-[24px] font-semibold tracking-tight" style={{ fontFamily: SERIF, color: INK }}>Annual</span>
          </div>
          <p className="mt-2 text-[15px]" style={{ color: MUTED }}>Unlimited groups, back-to-back challenges, all year.</p>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-[44px] leading-none" style={{ fontFamily: SERIF, color: INK }}>$79.99</span>
            <span className="text-[16px]" style={{ color: MUTED }}>/ year</span>
          </div>
          <p className="mt-2 text-[14px] font-semibold" style={{ color: ORANGE }}>
            Just $6.67/mo · starts with your 7-day free trial
          </p>
          <ul className="mt-5 space-y-3">
            {["Everything in Monthly", "Run back-to-back challenges", "Early access to new features"].map((f) => (
              <li key={f} className="flex items-center gap-3 text-[15px]" style={{ color: INK }}>
                <Check size={18} strokeWidth={2.5} style={{ color: ORANGE }} />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={onSelect}
            className="mt-6 w-full rounded-full py-4 text-[16px] font-semibold text-white"
            style={{ background: ORANGE }}
          >
            Start free trial — Annual
          </button>
        </div>

        <p className="mt-5 text-center text-[13px]" style={{ color: MUTED }}>
          No charge for 7 days. Cancel anytime before your trial ends.
        </p>

        {/* Compare plans */}
        <h2 className="mt-10 text-[28px] tracking-tight" style={{ fontFamily: SERIF, color: INK }}>
          Compare plans
        </h2>
        <div className="mt-4 rounded-[18px] bg-white overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] px-5 py-3" style={{ background: "#F7F4EE" }}>
            <div className="text-[12px] font-bold tracking-[0.1em]" style={{ color: "#8A8A95" }}>FEATURE</div>
            <div className="text-[12px] font-bold tracking-[0.1em] text-center" style={{ color: PURPLE }}>MONTHLY</div>
            <div className="text-[12px] font-bold tracking-[0.1em] text-center" style={{ color: ORANGE }}>ANNUAL</div>
          </div>
          {features.map((f, i) => (
            <div
              key={f.label}
              className="grid grid-cols-[1.4fr_1fr_1fr] items-center px-5 py-4"
              style={{ borderTop: i === 0 ? "none" : "1px solid #EFECE5" }}
            >
              <div className="text-[15px] font-semibold" style={{ color: INK }}>{f.label}</div>
              <div className="flex justify-center"><Cell v={f.monthly} /></div>
              <div className="flex justify-center"><Cell v={f.annual} /></div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[13px] leading-[1.5]" style={{ color: MUTED }}>
          Prices in USD. Subscriptions renew automatically until cancelled.<br />
          Questions? Email us at{" "}
          <a href="mailto:hello@pactara.app" className="font-semibold" style={{ color: PURPLE }}>hello@pactara.app</a>
        </p>
      </div>
    </div>
  );
}


function PaywallStep({
  onTrial,
  onFree,
  onBack,
}: {
  onTrial: () => void;
  onFree: () => void;
  onBack: () => void;
}) {
  const BG = "#F5F2EC";
  const INK = "#13131F";
  const MUTED = "#5A5A66";
  const ORANGE = "#C2410C";
  const [helpOpen, setHelpOpen] = useState(false);

  const trialFacts = [
    {
      Icon: Check,
      title: "Free for 7 days",
      body: "Full access to unlimited pods, check-ins, and progress cards — nothing held back.",
    },
    {
      Icon: Clock,
      title: "We'll remind you",
      body: "A reminder lands 2 days before your trial ends, so there's no surprise.",
    },
    {
      Icon: X,
      title: "Cancel anytime before Day 8",
      body: "Cancel in Settings → Subscriptions. You won't be charged if you cancel before the trial ends.",
    },
    {
      Icon: CreditCard,
      title: "After your trial",
      body: "$12.99/month, billed automatically until you cancel.",
    },
  ];

  const testimonials = [
    {
      badge: "🔥 21 day streak",
      title: "Finally Consistent",
      body: "My pod calls me out the second I skip a check-in. Haven't missed one in 6 weeks.",
      image:
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80",
    },
    {
      badge: "💪 +14 lbs lifted",
      title: "Worth Every Penny",
      body: "Seeing everyone's progress cards keeps me honest. First app that's actually stuck.",
      image:
        "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=600&q=80",
    },
    {
      badge: "⚖️ -12 lbs in 60 days",
      title: "Finally Consistent",
      body: "The daily check-ins changed everything. I show up because they show up.",
      image:
        "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=600&q=80",
    },
  ];


  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col overflow-y-auto"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: INK }}
    >
      <div className="min-h-[100dvh] flex flex-col shrink-0">
        <div className="flex items-center justify-end px-5 pt-3 shrink-0">
          <button
            type="button"
            aria-label="Help"
            onClick={() => setHelpOpen(true)}
            className="p-1"
            style={{ color: "#6B6B76" }}
          >
            <CircleHelp size={22} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 text-center shrink-0">
          <div className="text-[11px] font-bold tracking-[0.18em]" style={{ color: PURPLE }}>
            PACTARA PREMIUM
          </div>
          <h1
            className="mt-2 text-[34px] leading-[1.02] tracking-tight"
            style={{ fontFamily: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif", color: INK }}
          >
            Unlimited
            <br />
            Accountability
          </h1>
          <p className="mt-3 text-[14px] leading-[1.4]" style={{ color: MUTED }}>
            7 days free, then <span className="font-semibold" style={{ color: INK }}>$12.99/month</span>
            <br />
            cancel anytime before Day 8
          </p>
        </div>

        <div className="mt-[72px] flex-1 min-h-0 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex gap-3 px-6 pb-2 h-full">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="shrink-0 rounded-2xl bg-white flex flex-col overflow-hidden h-full"
                style={{
                  width: 220,
                  boxShadow: "0 1px 2px rgba(15,15,30,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)",
                }}
              >
                <div className="relative shrink-0 h-[182px] overflow-hidden">
                  <img
                    src={t.image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div
                    className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
                    style={{ background: INK }}
                  >
                    {t.badge}
                  </div>
                </div>

                <div className="px-3.5 pt-2.5 pb-3 shrink-0">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={12} fill="#F5B400" stroke="#F5B400" />
                    ))}
                  </div>
                  <div className="mt-1.5 text-[15px] font-bold tracking-tight" style={{ color: INK }}>
                    {t.title}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-[1.4]" style={{ color: MUTED }}>
                    {t.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 shrink-0 mt-auto">
          <div
            className="flex items-center justify-center gap-2 text-[14px] font-semibold"
            style={{ color: ORANGE }}
          >
            <CheckCircle2 size={16} strokeWidth={2.25} />
            No charge today, cancel anytime
          </div>

          <div className="mt-3">
            <PrimaryButton onClick={onTrial} label="Start Free Trial" withArrow />
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 shrink-0 text-center">
        <button
          type="button"
          onClick={onFree}
          className="text-[15px] font-medium underline"
          style={{ color: PURPLE }}
        >
          View All Plans
        </button>

        <div
          className="mt-3 text-[12px] flex items-center justify-center gap-3"
          style={{ color: "#6B6B76" }}
        >
          <a href="#" className="underline">Terms of Use</a>
          <span style={{ color: "#C9C9D1" }}>|</span>
          <a href="#" className="underline">Privacy Policy</a>

        </div>
      </div>

      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[28px] border-0 p-0 max-h-[88dvh] overflow-y-auto"
          style={{ background: "#FFFFFF" }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full" style={{ background: "#E4E4EA" }} />
          </div>
          <div className="px-6 pt-4 pb-8">
            <h2
              className="text-[28px] leading-[1.05] tracking-tight"
              style={{ fontFamily: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif", color: INK }}
            >
              Your trial, explained
            </h2>

            <div className="mt-6 flex flex-col">
              {trialFacts.map(({ Icon, title, body }, i) => (
                <div key={i}>
                  {i > 0 && <div className="h-px" style={{ background: "#EDEDF1" }} />}
                  <div className="flex gap-4 py-5">
                    <div
                      className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ background: "#EFEAFE", color: PURPLE }}
                    >
                      <Icon size={18} strokeWidth={2.25} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-bold" style={{ color: INK }}>
                        {title}
                      </div>
                      <p className="mt-1 text-[14px] leading-[1.45]" style={{ color: MUTED }}>
                        {body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------ Step: Greeting (Jose, you're in) ------------ */
export function GreetingStep({
  firstName,
  days,
  goalLabel,
  goalEmoji,
  frequencyLabel,
  onContinue,
  onBack,
}: {
  firstName: string;
  days: number;
  goalLabel: string;
  goalEmoji: string;
  frequencyLabel: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  const name = firstName || "friend";
  const howSteps = [
    { n: "1", emoji: "🌅", title: "Set your morning ritual", text: "Each morning, commit to one daily action with your group." },
    { n: "2", emoji: "📸", title: "Check in with proof", text: "Snap a quick photo or note showing you did the thing." },
    { n: "3", emoji: "🤝", title: "Show up for your group", text: "React, cheer, nudge. The group keeps you accountable." },
  ];
  const withoutList = [
    "Motivation fades after a week",
    "Nobody notices when you quit",
    "Slow progress, easy to give up",
  ];
  const withList = [
    "Daily accountability from your crew",
    "Proof-based check-ins that stick",
    "3× more likely to reach their goals",
  ];

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col px-6 pt-10 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="text-[56px] leading-none">🤝</div>
        <h1
          className="mt-4 text-[44px] leading-[0.95] tracking-tight"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          You're in, {name}.
        </h1>
        <p className="mt-3 text-[15px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
          Your {days}-day commitment is locked in. Here's what to expect.
        </p>
      </div>

      {/* Commitment details */}
      <div className="mt-8 rounded-3xl p-5" style={{ background: "#F5F3F0" }}>
        <div className="text-[17px] font-bold">Your commitment</div>
        <div className="mt-4 flex flex-col gap-2">
          <div className="rounded-2xl bg-white p-4 flex items-center gap-3">
            <span className="text-[22px]">{goalEmoji}</span>
            <div className="flex-1">
              <div className="text-[12px] uppercase tracking-wide" style={{ color: LABEL }}>Goal</div>
              <div className="text-[15px] font-semibold">{goalLabel}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 flex items-center gap-3">
            <Clock size={20} style={{ color: PURPLE }} />
            <div className="flex-1">
              <div className="text-[12px] uppercase tracking-wide" style={{ color: LABEL }}>Duration</div>
              <div className="text-[15px] font-semibold">{days} days</div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 flex items-center gap-3">
            <CheckCircle2 size={20} style={{ color: PURPLE }} />
            <div className="flex-1">
              <div className="text-[12px] uppercase tracking-wide" style={{ color: LABEL }}>Frequency</div>
              <div className="text-[15px] font-semibold">{frequencyLabel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-4 rounded-3xl p-5" style={{ background: PURPLE_SOFT }}>
        <div className="text-[17px] font-bold">How it works</div>
        <div className="mt-4 flex flex-col gap-3">
          {howSteps.map((s) => (
            <div key={s.n} className="rounded-2xl p-4 flex items-start gap-3 bg-white">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[14px] font-bold shrink-0"
                style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
              >
                {s.n}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">{s.emoji}</span>
                  <div className="text-[15px] font-semibold">{s.title}</div>
                </div>
                <p className="mt-1 text-[13px] leading-[1.45]" style={{ color: TEXT_MUTED }}>
                  {s.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* With / Without Pactara */}
      <div className="mt-4 rounded-3xl p-5" style={{ background: PURPLE_SOFT }}>
        <div className="text-[17px] font-bold">Why Pactara?</div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-2xl bg-white p-4">
            <div className="text-[15px] font-semibold">Without Pactara</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {withoutList.map((t) => (
                <div key={t} className="flex items-start gap-2 text-[14px]" style={{ color: TEXT_MUTED }}>
                  <X size={16} className="mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <div className="text-[15px] font-semibold">With Pactara</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {withList.map((t) => (
                <div key={t} className="flex items-start gap-2 text-[14px]" style={{ color: TEXT_MUTED }}>
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: "#16A34A" }} strokeWidth={3} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <PrimaryButton onClick={onContinue} label="Let's go" withArrow />
      </div>
    </div>
  );
}


/* ------------ Step: How it works ------------ */
export function HowItWorksStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const steps = [
    {
      n: "1",
      emoji: "🌅",
      title: "Set your morning ritual",
      text: "Each morning, commit to one daily action with your group. Small daily moves are how big goals actually happen.",
    },
    {
      n: "2",
      emoji: "📸",
      title: "Check in with proof",
      text: "Snap a quick photo or note showing you did the thing. Your group sees it the moment you post.",
    },
    {
      n: "3",
      emoji: "🤝",
      title: "Show up for your group",
      text: "React, cheer, nudge. The group keeps you accountable, and you do the same for them.",
    },
  ];
  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col px-6 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT, paddingTop: 32 }}
    >
      <h1 className="text-[40px] font-bold tracking-tight leading-[1.05]">Here's how it works</h1>
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

      <PrimaryButton onClick={onDone} label="Continue" withArrow />
    </div>
  );
}


/* ------------ Step: Consistency (interstitial) ------------ */
function ConsistencyStep({
  onContinue,
  onBack,
  progress,
}: {
  onContinue: () => void;
  onBack: () => void;
  progress: number;
}) {
  return (
    <div
      className="h-[100dvh] w-full flex flex-col px-6 pb-8 overflow-hidden"
      style={{
        background: "#FFFFFF",
        fontFamily: "Inter, system-ui, sans-serif",
        color: TEXT,
        paddingTop: 32,
      }}
    >
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="-ml-1 p-1 shrink-0">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: TRACK }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: PURPLE }}
          />
        </div>
      </div>

      <div className="mt-10 flex-1 flex flex-col min-h-0 overflow-y-auto">
        <h1 className="text-[36px] font-bold tracking-tight leading-[1.05]">
          Staying consistent takes accountability.
        </h1>

        <div className="mt-8 rounded-3xl p-5" style={{ background: "#F5F3F0" }}>
          <div className="text-[15px] font-semibold text-black">Consistency over time</div>

          <div className="mt-4 relative h-[220px]">
            <svg viewBox="0 0 320 200" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="purpleFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.04" />
                </linearGradient>
                <linearGradient id="redFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <line x1="0" y1="60" x2="320" y2="60" stroke="#D6D2CC" strokeDasharray="4 6" />
              <line x1="0" y1="120" x2="320" y2="120" stroke="#D6D2CC" strokeDasharray="4 6" />
              <path d="M0,100 C 80,110 160,150 320,170 L320,200 L0,200 Z" fill="url(#redFill)" />
              <path
                d="M0,100 C 80,110 160,150 320,170"
                stroke="#EF4444"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <path d="M0,100 C 100,80 200,55 320,30 L320,200 L0,200 Z" fill="url(#purpleFill)" />
              <path
                d="M0,100 C 100,80 200,55 320,30"
                stroke="#7C3AED"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="320" cy="30" r="5" fill="#7C3AED" />
              <circle cx="320" cy="170" r="5" fill="#EF4444" />
            </svg>
          </div>

          <div className="mt-2 flex justify-between text-[13px] text-[#8A8580]">
            <span>Week 1</span>
            <span>Week 12</span>
          </div>

          <div className="mt-5 flex items-center justify-center gap-6 text-[13px] text-black">
            <div className="flex items-center gap-2">
              <span className="w-6 h-[3px] rounded-full" style={{ background: "#7C3AED" }} />
              <span>🔥 With Pactara</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-[3px] rounded-full" style={{ background: "#EF4444" }} />
              <span>Going alone</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[16px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
          People who check in with a group are{" "}
          <span className="font-bold text-black">3× more likely</span> to reach their goals.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 pt-6">
        <PrimaryButton onClick={onContinue} label="Continue" withArrow />
      </div>
    </div>
  );
}


