import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Users, CalendarDays } from "lucide-react";
import { getPact, signPact, DEFAULT_PACT_LINES } from "@/lib/pact.functions";
import { hapticLight, hapticMedium } from "@/lib/native";
import ConfettiBurst from "@/components/ConfettiBurst";
import { recordAuthenticatedOnboardingStep } from "@/lib/onboarding-analytics.functions";
import { clearOnboardingJourney, readOnboardingJourney } from "@/lib/onboarding-analytics";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";

export const Route = createFileRoute("/_authenticated/pact/$groupId")({
  component: PactPage,
  head: () => ({
    meta: [
      { title: "Sign the pact — Pactara" },
      { name: "description", content: "Make your commitment to the group before the challenge begins." },
      { property: "og:title", content: "Sign the pact — Pactara" },
      { property: "og:description", content: "Make your commitment to the group before the challenge begins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 text-center bg-white">
      <div>
        <div className="text-[18px] font-bold mb-2">We couldn't load this pact</div>
        <div className="text-[14px] text-neutral-500">{error.message}</div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white">
      <div className="text-[16px]">Pact not found.</div>
    </div>
  ),
});

function PactPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchPact = useServerFn(getPact);
  const sign = useServerFn(signPact);
  const recordOnboardingStep = useServerFn(recordAuthenticatedOnboardingStep);

  const { data, isLoading } = useQuery({
    queryKey: ["pact", groupId],
    queryFn: () => fetchPact({ data: { groupId } }),
  });
  const { data: partnerState } = usePartnerState();
  const relation = relationForGroup(groupId, partnerState);

  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const journey = readOnboardingJourney();
    if (!journey) return;
    void recordOnboardingStep({ data: { ...journey, step: "pact" } }).catch(() => undefined);
  }, [recordOnboardingStep]);

  useEffect(() => {
    if (data?.hasSigned) setSigned(true);
  }, [data?.hasSigned]);

  const lines = useMemo(() => {
    const custom = data?.promise?.trim();
    return custom ? [custom, ...DEFAULT_PACT_LINES] : DEFAULT_PACT_LINES;
  }, [data?.promise]);

  const me = data?.members.find((m) => m.isMe) ?? null;

  const doSign = async () => {
    if (signing || signed) return;
    setSigning(true);
    setError(null);
    try {
      await sign({ data: { groupId } });
      if (data?.isPartner) {
        void import("@/lib/partners.functions")
          .then((m) => m.trackPartnerScreen({ data: { event: "partner_pact_completed" } }))
          .catch(() => undefined);
      }
      const journey = readOnboardingJourney();
      if (journey) {
        await recordOnboardingStep({ data: { ...journey, step: "pact" } }).catch(() => undefined);
        clearOnboardingJourney();
      }
      void hapticMedium();
      setSigned(true);
      await queryClient.invalidateQueries({ queryKey: ["pact", groupId] });
      setShowSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign the pact");
    } finally {
      setSigning(false);
    }
  };

  const enterGroup = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("active-group-id", groupId);
      // Intro offer shows once, right after the pact.
      localStorage.setItem("show-intro-paywall", "1");
    }
    navigate({ to: "/home" });
  };

  const frequencyLabel =
    data && data.frequency !== "daily" ? `${data.daysPerWeek}× per week` : "Every day";

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col"
      style={{
        background: `linear-gradient(180deg, ${PURPLE_DEEP} 0%, ${PURPLE} 45%, #F5F2EE 45.1%, #F5F2EE 100%)`,
        fontFamily: "Inter, system-ui, sans-serif",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="px-6 pt-6 pb-8 text-white">
        <div className="text-[13px] font-semibold tracking-[0.18em] opacity-80">
          {signed ? "THE PACT IS SIGNED" : "BEFORE YOU START"}
        </div>
        <h1 className="text-[30px] font-black leading-[1.1] mt-2">
          {signed ? "You're in." : "Make the pact"}
        </h1>
        <p className="text-[15px] mt-2 opacity-90 leading-snug">
          {signed
            ? "Your name is on it. Here's who else is in."
            : "Make a promise to yourself and the people counting on you."}
        </p>
      </div>

      <div className="flex-1 px-4 pb-40">
        {/* Pact card */}
        <div
          className="rounded-3xl bg-white p-6"
          style={{ boxShadow: "0 20px 40px -24px rgba(0,0,0,0.35)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-[26px] shrink-0"
              style={{ background: "#F1E9FF" }}
            >
              {data?.emoji ?? "🔥"}
            </div>
            <div className="min-w-0">
              <div className="text-[19px] font-black leading-tight truncate">
                {isLoading ? "Loading…" : relation?.name ?? data?.name}
              </div>
              {data?.goal && (
                <div className="text-[13px] text-neutral-500 truncate">🎯 {data.goal}</div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat
              icon={<CalendarDays size={15} style={{ color: PURPLE }} />}
              value={data ? `${data.durationDays} days` : "—"}
              label={frequencyLabel}
            />
            <Stat
              icon={<Users size={15} style={{ color: PURPLE }} />}
              value={data ? `${data.memberCount}` : "—"}
              label={data && data.memberCount === 1 ? "member" : "members"}
            />
          </div>

          {data && data.members.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <AvatarStack members={data.members} />
              <div className="text-[13px] text-neutral-500 leading-snug">
                {data.memberCount === 1
                  ? "You're the first one in"
                  : `${data.memberCount} people are making this pact together`}
              </div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-neutral-100">
            <div className="text-[11px] font-bold tracking-[0.16em] text-neutral-400 mb-4">
              THE PACT
            </div>
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span
                    className="mt-[3px] h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "#F1E9FF" }}
                  >
                    <Check size={12} style={{ color: PURPLE }} strokeWidth={3} />
                  </span>
                  <span className="text-[15px] leading-snug font-medium">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {signed && (
            <div
              className="mt-6 rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: "#ECFDF3" }}
            >
              <span className="h-8 w-8 rounded-full bg-[#16A34A] flex items-center justify-center">
                <Check size={16} className="text-white" strokeWidth={3} />
              </span>
              <div className="text-[14px] font-semibold text-[#166534]">
                Signed by {me?.name ?? "you"}
              </div>
            </div>
          )}
        </div>

        {/* Who's signed */}
        {signed && (
          <div className="rounded-3xl bg-white p-5 mt-4">
            <div className="text-[11px] font-bold tracking-[0.16em] text-neutral-400 mb-4">
              WHO'S SIGNED · {data?.signedCount ?? 0}/{data?.memberCount ?? 0}
            </div>
            <div className="space-y-3">
              {(data?.members ?? []).map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center text-white text-[15px] font-bold shrink-0"
                    style={{ background: m.avatarColor }}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      m.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 text-[15px] font-semibold truncate">
                    {m.name}
                    {m.isMe && <span className="text-neutral-400 font-medium"> (you)</span>}
                  </div>
                  {m.signed ? (
                    <span className="text-[13px] font-semibold text-[#16A34A] flex items-center gap-1">
                      <Check size={14} strokeWidth={3} /> Signed
                    </span>
                  ) : (
                    <span className="text-[13px] text-neutral-400">Not yet</span>
                  )}
                </div>
              ))}
            </div>
            {data && data.signedCount < data.memberCount && (
              <p className="text-[13px] text-neutral-500 mt-4 leading-snug">
                We'll let you know as the rest of the group signs.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl bg-red-600 text-white px-4 py-3 text-[14px]" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div
        className="fixed inset-x-0 bottom-0 px-4 pt-4 bg-gradient-to-t from-[#F5F2EE] via-[#F5F2EE] to-transparent"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {signed ? (
          <button
            onClick={enterGroup}
            className="w-full h-14 rounded-2xl text-white text-[16px] font-bold flex items-center justify-center gap-2"
            style={{ background: PURPLE }}
          >
            Enter the group <ChevronRight size={18} />
          </button>
        ) : (
          <>
            <div className="text-center text-[13px] text-neutral-500 mb-3">Ready to commit?</div>
            <SwipeToSign
              disabled={isLoading || signing}
              busy={signing}
              avatarUrl={me?.avatarUrl ?? null}
              avatarColor={me?.avatarColor ?? PURPLE_DEEP}
              initial={(me?.name ?? "Y").slice(0, 1).toUpperCase()}
              onComplete={doSign}
            />
          </>
        )}
      </div>

      {showSuccess && data && (
        <PactSuccess
          groupName={relation?.name ?? data.name}
          emoji={relation?.emoji ?? data.emoji ?? "🔥"}
          signedCount={data.signedCount}
          memberCount={data.memberCount}
          durationDays={data.durationDays}
          isPartner={data.isPartner}
          members={data.members}
          onDone={enterGroup}
        />
      )}
    </div>
  );
}

type PactMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  signed: boolean;
  isMe: boolean;
};

function Avatar({ m, size = 32 }: { m: PactMember; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center text-white font-bold shrink-0 ring-2 ring-white"
      style={{ background: m.avatarColor, height: size, width: size, fontSize: size * 0.42 }}
    >
      {m.avatarUrl ? (
        <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
      ) : (
        m.name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function AvatarStack({
  members,
  size = 32,
  max = 4,
}: {
  members: PactMember[];
  size?: number;
  max?: number;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
          <Avatar m={m} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="rounded-full flex items-center justify-center font-bold ring-2 ring-white shrink-0"
          style={{
            marginLeft: -10,
            height: size,
            width: size,
            fontSize: size * 0.36,
            background: "#F1E9FF",
            color: PURPLE_DEEP,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function PactSuccess({
  groupName,
  emoji,
  signedCount,
  memberCount,
  durationDays,
  isPartner = false,
  members,
  onDone,
}: {
  groupName: string;
  emoji: string;
  signedCount: number;
  memberCount: number;
  durationDays: number;
  isPartner?: boolean;
  members: PactMember[];
  onDone: () => void;
}) {
  const everyone = signedCount >= memberCount;
  const waiting = members.filter((m) => !m.signed && !m.isMe);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const t = window.setTimeout(() => doneRef.current(), everyone ? 2800 : 2000);
    return () => window.clearTimeout(t);
  }, [everyone]);

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-8 text-center animate-in fade-in duration-200"
      style={{ background: `linear-gradient(180deg, ${PURPLE_DEEP} 0%, ${PURPLE} 100%)` }}
    >
      {everyone && <ConfettiBurst durationMs={2600} />}

      <div className="text-[14px] font-semibold text-white/70 animate-in fade-in duration-300">
        <span className="mr-1.5">{emoji}</span>
        {groupName}
      </div>

      {everyone ? (
        <>
          <div
            className="mt-6 h-16 w-16 rounded-full bg-white flex items-center justify-center animate-in zoom-in duration-300"
            style={{ boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}
          >
            <Check size={30} style={{ color: PURPLE }} strokeWidth={3} />
          </div>
          <div className="mt-5 text-[12px] font-bold tracking-[0.2em] text-white/80 animate-in fade-in duration-500">
            THE PACT IS MADE
          </div>
          <div className="mt-2 text-[28px] font-black text-white leading-tight animate-in fade-in duration-500">
            {isPartner ? "You're both in." : "Everyone's in."}
          </div>
          <div className="mt-4 text-[15px] text-white/80 animate-in fade-in duration-700">
            {isPartner
              ? `${durationDays} days of showing up together.`
              : `${memberCount} ${memberCount === 1 ? "person" : "people"} · ${durationDays} days`}
          </div>
          <div className="mt-2 text-[15px] font-semibold text-white/90 animate-in fade-in duration-700">
            Now show up.
          </div>
        </>
      ) : (
        <>
          <div
            className="mt-6 h-16 w-16 rounded-full bg-white flex items-center justify-center animate-in zoom-in duration-300"
            style={{ boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}
          >
            <Check size={30} style={{ color: PURPLE }} strokeWidth={3} />
          </div>
          <div className="mt-5 text-[26px] font-black text-white leading-tight animate-in fade-in duration-500">
            Pact made
          </div>
          <div className="mt-1 text-[16px] text-white/90 animate-in fade-in duration-500">
            You're in.
          </div>
          <div className="mt-4 text-[14px] text-white/75 animate-in fade-in duration-700">
            {signedCount} of {memberCount} have made the pact
          </div>
          {waiting.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2 animate-in fade-in duration-700">
              <AvatarStack members={waiting} size={36} max={3} />
              <div className="text-[13px] text-white/75">
                {waiting.length === 1
                  ? `Waiting on ${waiting[0].name.split(" ")[0]}`
                  : `${waiting.length} people still need to make the pact`}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: "#F7F4FF" }}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[16px] font-extrabold">{value}</span>
      </div>
      <div className="text-[12px] text-neutral-500 mt-0.5">{label}</div>
    </div>
  );
}

function SwipeToSign({
  onComplete,
  disabled,
  busy,
  avatarUrl,
  avatarColor,
  initial,
}: {
  onComplete: () => void;
  disabled?: boolean;
  busy?: boolean;
  avatarUrl: string | null;
  avatarColor: string;
  initial: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const ticked = useRef(false);
  const startX = useRef(0);
  const maxRef = useRef(0);

  const THUMB = 56;
  const PAD = 4;

  const maxTravel = () => {
    const w = trackRef.current?.clientWidth ?? 0;
    return Math.max(0, w - THUMB - PAD * 2);
  };

  const onDown = (clientX: number) => {
    if (disabled || busy) return;
    maxRef.current = maxTravel();
    startX.current = clientX - x;
    ticked.current = false;
    setDragging(true);
  };

  const onMove = (clientX: number) => {
    if (!dragging) return;
    const next = Math.min(maxRef.current, Math.max(0, clientX - startX.current));
    setX(next);
    if (!ticked.current && maxRef.current > 0 && next > maxRef.current * 0.5) {
      ticked.current = true;
      void hapticLight();
    }
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const max = maxRef.current;
    if (max > 0 && x >= max - 6) {
      setX(max);
      onComplete();
    } else {
      setX(0);
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => onMove(e.clientX);
    const up = () => onUp();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  const progress = maxRef.current > 0 ? x / maxRef.current : 0;

  return (
    <div>
      <div
        ref={trackRef}
        className="relative h-16 rounded-2xl overflow-hidden select-none touch-none"
        style={{ background: "#EDE7F6" }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${THUMB + x}px`,
            background: `linear-gradient(90deg, ${PURPLE_DEEP}, ${PURPLE})`,
            transition: dragging ? "none" : "width 220ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none text-[15px] font-bold"
          style={{ color: PURPLE_DEEP, opacity: 1 - progress }}
        >
          {busy ? "Making the pact…" : "Swipe to make the pact →"}
        </div>
        <div
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            onDown(e.clientX);
          }}
          className="absolute top-1 bottom-1 w-14 rounded-xl bg-white flex items-center justify-center shadow-sm cursor-grab active:cursor-grabbing"
          style={{
            left: PAD,
            transform: `translateX(${x}px)`,
            transition: dragging ? "none" : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div
            className="h-11 w-11 rounded-lg overflow-hidden flex items-center justify-center text-white text-[16px] font-bold"
            style={{ background: avatarColor }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
