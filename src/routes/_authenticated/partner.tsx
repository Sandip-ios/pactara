import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ChevronLeft, Handshake } from "lucide-react";
import partnerHero from "@/assets/partner-hero.jpg";
import { clearSignupResume, getSignupResume, saveSignupResume } from "@/lib/signup-resume";
import {
  acceptPartnership,
  findPartner,
  getPartnerState,
  requestNewPartner,
  trackPartnerScreen,
  type PartnerPerson,
} from "@/lib/partners.functions";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/partner")({
  validateSearch: (s: Record<string, unknown>) => ({
    solo: typeof s.solo === "string" ? s.solo : undefined,
  }),
  component: PartnerPage,
  head: () => ({
    meta: [
      { title: "Accountability partner · Pactara" },
      { name: "description", content: "Get paired with someone who's ready to show up with you." },
      { property: "og:title", content: "Accountability partner · Pactara" },
      { property: "og:description", content: "Get paired with someone who's ready to show up with you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const PURPLE_SOFT = "#F3EEFF";
const MUTED = "#6B6660";
const LABEL = "#8A8580";


/** Candidates orbiting the search on the waiting screen. */
const ORBITERS = [
  { radius: 104, duration: 9, delay: 0, size: 12, color: "#7C3AED" },
  { radius: 104, duration: 9, delay: -3, size: 10, color: "#A78BFA" },
  { radius: 104, duration: 9, delay: -6, size: 9, color: "#DDD6FE" },
  { radius: 76, duration: 6.5, delay: 0, size: 8, color: "#C4B5FD" },
  { radius: 76, duration: 6.5, delay: -3.25, size: 7, color: "#8B5CF6" },
];

/** Faster orbit for the full-screen matching takeover. */
const FAST_ORBITERS = [
  { radius: 104, duration: 3.2, delay: 0, size: 12, color: "#7C3AED" },
  { radius: 104, duration: 3.2, delay: -1.1, size: 10, color: "#A78BFA" },
  { radius: 104, duration: 3.2, delay: -2.2, size: 9, color: "#DDD6FE" },
  { radius: 76, duration: 2.3, delay: 0, size: 8, color: "#C4B5FD" },
  { radius: 76, duration: 2.3, delay: -1.15, size: 7, color: "#8B5CF6" },
];

function PartnerPage() {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
  const router = useRouter();
  const { solo } = Route.useSearch();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getPartnerState);
  const search = useServerFn(findPartner);
  const accept = useServerFn(acceptPartnership);
  const rematch = useServerFn(requestNewPartner);
  const track = useServerFn(trackPartnerScreen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justMatched, setJustMatched] = useState(false);
  const [matching, setMatching] = useState<null | "searching" | "locked">(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["partner-state"],
    queryFn: () => fetchState(),
    refetchInterval: 20_000,
  });

  const tracked = useRef<string | null>(null);
  useEffect(() => {
    const p = data?.partnership;
    if (data?.status === "pending" && p && !p.iAccepted && tracked.current !== p.id) {
      tracked.current = p.id;
      void track({ data: { event: "partner_match_viewed", partnershipId: p.id } }).catch(() => undefined);
    }
  }, [data, track]);


  // A match that lands while the user is on the waiting screen still gets the
  // dramatic reveal — same as an instant match right after tapping the button.
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    const before = prevStatus.current;
    prevStatus.current = data?.status ?? null;
    if (
      data?.status === "pending" &&
      data.partnership &&
      !data.partnership.iAccepted &&
      (before === "waiting" || before === "none")
    ) {
      setJustMatched(true);
    }
  }, [data]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const goHome = () => navigate({ to: "/home", replace: true });
  // The intro screen is a pure decision point — back returns to wherever
  // the user came from, falling back to Home when there's no history.
  const goBack = () => {
    // Fresh from signup: return to the last onboarding screen (notifications).
    const resume = getSignupResume();
    if (resume?.method === "partner") {
      saveSignupResume({ ...resume, onPartner: false });
      navigate({ to: "/signup", replace: true });
      return;
    }
    const prev = typeof window !== "undefined" ? sessionStorage.getItem("pactara:prev-path") : null;
    const isAuthOrOnboarding =
      !prev || /^\/(login|signin|sign-in|auth|signup|welcome|reset|forgot|onboarding)?(\/|$)/.test(prev);
    if (!isAuthOrOnboarding && window.history.length > 1) router.history.back();
    else goHome();
  };
  const soloGroupId = solo ?? data?.soloGroupId ?? null;

  // Tapping "Find me a partner" takes over the whole screen: a live matching
  // sequence plays, then it jumps straight to the reveal (or the waiting
  // radar if no one is in line yet). The overlay holds for a beat so the
  // moment reads even when the match resolves instantly.
  const onFind = async () => {
    if (busy || matching) return;
    setBusy(true);
    setError(null);
    setMatching("searching");
    const minTheatrics = new Promise((r) => setTimeout(r, 1900));
    try {
      clearSignupResume();
      const res = await search({ data: { soloGroupId } });
      if (res.matched) {
        setMatching("locked");
        setJustMatched(true);
        await minTheatrics;
      } else {
        await minTheatrics;
      }
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setMatching(null);
      setBusy(false);
    }
  };

  const onAccept = () =>
    run(async () => {
      const p = data?.partnership;
      if (!p) return;
      const res = await accept({ data: { partnershipId: p.id } });
      if (res.active && res.groupId) {
        void track({ data: { event: "partner_pact_started", partnershipId: p.id } }).catch(() => undefined);
        navigate({ to: "/pact/$groupId", params: { groupId: res.groupId }, replace: true });
      }
    });

  const onRematch = () => run(() => rematch());

  if (isLoading || !data) {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#EAE4F5] border-t-[#7C3AED]" />
        </div>
      </Shell>
    );
  }

  const p = data.partnership;

  // Match found, waiting on this person — snap in with a reveal the moment
  // the match lands (instant match or a poll picking one up mid-search).
  if (data.status === "pending" && p && !p.iAccepted) {
    return (
      <Shell onBack={goHome}>
        {justMatched && <ConfettiBurst durationMs={2200} />}
        {matching && <MatchingOverlay locked={matching === "locked"} />}
        <div className="relative flex-1 min-h-0 overflow-y-auto flex flex-col items-center text-center pb-2">
          {justMatched && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-52 h-56 w-56 rounded-full bg-pactara-purple/25 blur-3xl"
              style={{ animation: "partner-burst 1100ms ease-out 1 forwards" }}
            />
          )}
          <h1
            className="mt-4 w-full whitespace-nowrap px-2 text-[clamp(34px,10.5vw,44px)] font-bold leading-[1.1] tracking-tight bg-gradient-to-r from-pactara-purple to-pactara-purple-deep bg-clip-text text-transparent"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            <span className="motion-safe:inline-block motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:duration-500">
              It's a Match!
            </span>
          </h1>
          <p className="mt-3 text-[17px] font-semibold motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
            You've got a partner
          </p>
          <p className="mt-1 text-[15px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700" style={{ color: MUTED, animationDelay: "200ms", animationFillMode: "both" }}>
            Meet the person showing up with you.
          </p>

          <div className="relative mt-7 h-40 w-full max-w-[330px]" aria-label={`You and ${p.partner.name}`}>
            <span aria-hidden className="absolute left-1/2 top-[58px] h-8 w-20 -translate-x-1/2 rounded-full bg-pactara-purple/15 blur-xl" />
            <div
              className="absolute left-[9%] top-0 z-10 flex flex-col items-center"
              style={justMatched ? { animation: "partner-avatar-left 800ms cubic-bezier(0.34,1.56,0.64,1) 1" } : undefined}
            >
              <Avatar person={data.me} size={126} className="ring-[5px] ring-background shadow-xl" />
              <span className="mt-2 rounded-full bg-foreground px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-background">You</span>
            </div>
            <div
              className="absolute right-[9%] top-0 z-20 flex flex-col items-center"
              style={justMatched ? { animation: "partner-avatar-right 800ms cubic-bezier(0.34,1.56,0.64,1) 1" } : undefined}
            >
              <Avatar person={p.partner} size={126} className="ring-[5px] ring-background shadow-xl" />
              <span className="mt-2 rounded-full bg-pactara-purple px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-pactara-purple-foreground">
                {p.partner.name}
              </span>
            </div>
            <span
              aria-hidden
              className="absolute left-1/2 top-[48px] z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-background bg-pactara-purple text-[15px] font-bold text-pactara-purple-foreground shadow-lg"
              style={justMatched ? { animation: "partner-link-pop 900ms cubic-bezier(0.34,1.56,0.64,1) 350ms both" } : undefined}
            >
              +
            </span>
          </div>
          <div className="mt-5 grid w-full grid-cols-2 gap-2 text-left">
            <div
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700"
              style={{ animationDelay: "150ms", animationFillMode: "both" }}
            >
              <GoalCard label="YOUR GOAL" goal={data.myGoal} mine />
            </div>
            <div
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700"
              style={{ animationDelay: "280ms", animationFillMode: "both" }}
            >
              <GoalCard label={`${p.partner.name.toUpperCase()}'S GOAL`} goal={p.partner.goal} />
            </div>
          </div>
          <p className="mt-5 text-[17px] font-semibold">{p.durationDays} days of showing up together.</p>
          <p className="mt-1 text-[15px]" style={{ color: MUTED }}>
            Different goals. Same commitment.
          </p>
        </div>
        <Footer error={error}>
          <PrimaryButton label={busy ? "Starting…" : "Start together"} onClick={onAccept} disabled={busy} />
        </Footer>
      </Shell>
    );
  }

  // Accepted; the other person hasn't yet.
  if (data.status === "pending" && p && p.iAccepted) {
    return (
      <Shell onBack={goHome}>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Avatar person={p.partner} size={88} />
          <h1 className="mt-6 text-[34px] font-bold tracking-tight">You're in.</h1>
          <p className="mt-2 text-[17px]" style={{ color: MUTED }}>
            Waiting for {p.partner.name}.
          </p>
          <p className="mt-4 text-[14px] max-w-[280px]" style={{ color: MUTED }}>
            We'll let you know the moment they're in. Keep showing up in the meantime.
          </p>
        </div>
        <Footer error={error}>
          <PrimaryButton label="Continue" onClick={goHome} />
        </Footer>
      </Shell>
    );
  }

  // Active partnership.
  if (data.status === "active" && p) {
    if (p.partnerInactive) {
      return (
        <Shell onBack={goHome}>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Avatar person={p.partner} size={88} />
            <h1 className="mt-6 text-[28px] font-bold tracking-tight leading-tight">
              Looks like {p.partner.name} hasn't been active lately.
            </h1>
            <p className="mt-3 text-[16px]" style={{ color: MUTED }}>
              Want us to find you another partner?
            </p>
          </div>
          <Footer error={error}>
            <PrimaryButton label={busy ? "Finding…" : "Find another partner"} onClick={onRematch} disabled={busy} />
            <TextButton label="Keep waiting" onClick={goHome} />
          </Footer>
        </Shell>
      );
    }
    return (
      <Shell onBack={goHome}>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Avatar person={p.partner} size={88} />
          <div className="mt-5 text-[12px] font-bold tracking-[0.16em]" style={{ color: LABEL }}>
            ACCOUNTABILITY PARTNER
          </div>
          <h1 className="mt-2 text-[30px] font-bold tracking-tight">You + {p.partner.name}</h1>
          <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
            {p.durationDays} days of showing up together.
          </p>
        </div>
        <Footer error={error}>
          <PrimaryButton
            label="Open partnership"
            onClick={() => {
              if (p.groupId) {
                localStorage.setItem("active-group-id", p.groupId);
                navigate({ to: "/pact/$groupId", params: { groupId: p.groupId } });
              } else goHome();
            }}
          />
          <TextButton label={busy ? "Finding…" : "Find another partner"} onClick={onRematch} />
        </Footer>
      </Shell>
    );
  }

  // In line for a partner — a live matching animation, not a static wait.
  if (data.status === "waiting") {
    return (
      <Shell>
        {matching && <MatchingOverlay locked={matching === "locked"} />}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="relative h-64 w-64 flex items-center justify-center">
            {/* Radar sweep rings radiating from the search */}
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden
                className="absolute h-28 w-28 rounded-full border-2 border-pactara-purple/35"
                style={{ animation: `partner-radar 3s ease-out ${i}s infinite` }}
              />
            ))}
            <span aria-hidden className="absolute h-40 w-40 rounded-full bg-pactara-purple/10 blur-2xl" />
            {/* Candidate partners being scanned, orbiting the search */}
            {ORBITERS.map((o, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute"
                style={
                  {
                    "--orbit-r": `${o.radius}px`,
                    animation: `partner-orbit ${o.duration}s linear ${o.delay}s infinite`,
                  } as React.CSSProperties
                }
              >
                <span
                  className="block rounded-full shadow-md"
                  style={{ width: o.size, height: o.size, background: o.color }}
                />
              </span>
            ))}
            <span
              className="relative h-24 w-24 rounded-full flex items-center justify-center shadow-partner-icon"
              style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
            >
              <Handshake size={38} color="white" strokeWidth={2} />
            </span>
          </div>
          <h1 className="mt-8 text-[30px] font-bold tracking-tight leading-tight">
            {data.released ? "We're still finding your person" : "We're finding your person"}
          </h1>
          <div className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-pactara-purple/10">
            <div className="relative h-full w-full">
              <span
                aria-hidden
                className="absolute inset-y-0 w-1/3 rounded-full bg-linear-to-r from-transparent via-pactara-purple to-transparent"
                style={{ animation: "partner-shimmer 1.8s ease-in-out infinite" }}
              />
            </div>
          </div>

        </div>
        <Footer error={error}>
          <PrimaryButton label="Continue" onClick={goHome} />
          <TextButton
            label="Invite someone instead"
            onClick={() =>
              soloGroupId
                ? navigate({ to: "/groups/$groupId", params: { groupId: soloGroupId } })
                : navigate({ to: "/new-pactara" })
            }
          />
        </Footer>
      </Shell>
    );
  }

  // Not searching yet.
  return (
    <Shell flush>
      {matching && <MatchingOverlay locked={matching === "locked"} />}
      {/* Hero imagery */}
      <div className="relative h-[52%] w-full shrink-0 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700">
        <img
          src={partnerHero}
          alt="Two workout partners walking together, fist bumping after a session"
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-linear-to-b from-pactara-purple/20 via-transparent to-background" />
        <button
          onClick={goBack}
          aria-label="Back"
          className="absolute left-5 top-12 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/80 text-pactara-purple-deep shadow-sm backdrop-blur-md active:scale-95"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="absolute bottom-5 left-6 z-10 flex items-center gap-2 rounded-2xl border border-white/50 bg-white/90 px-4 py-2.5 shadow-xl backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-pactara-purple-deep">
            90-day partnership
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col px-6 pb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-pactara-purple/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 top-1/2 h-32 w-32 rounded-full bg-pactara-purple-deep/5 blur-2xl" />
        <div className="flex flex-1 flex-col justify-center">
          <div className="inline-flex self-start rounded-full bg-pactara-purple/10 px-3 py-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pactara-purple">
              Partner matching
            </span>
          </div>
          <h1 className="mt-4 max-w-[330px] text-[32px] font-bold leading-[1.1] tracking-tight text-foreground">
            Find an <span className="text-pactara-purple">accountability</span> partner
          </h1>
          <p className="mt-3 max-w-[320px] text-[17px] font-medium leading-relaxed text-muted-foreground">
            We'll pair you with someone who's ready to show up too. Different goals, same commitment.
          </p>
        </div>
        <div className="pt-4 flex flex-col items-center gap-3">
          {error && (
            <div className="w-full rounded-xl bg-red-50 text-red-700 px-4 py-3 text-[14px]" role="alert">
              {error}
            </div>
          )}
          <Button
            type="button"
            onClick={onFind}
            disabled={busy}
            className="h-14 w-full rounded-2xl text-[16px] font-semibold text-white shadow-partner-cta transition-transform active:scale-[0.98] disabled:opacity-60 hover:opacity-90"
            style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
          >
            {busy ? "Finding your partner…" : "Find me a partner"}
            <ArrowRight size={20} strokeWidth={2.5} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Shell>
  );
}

/**
 * Full-screen takeover right after "Find me a partner": the search spins up
 * live — fast radar rings, candidates racing past — and when a match locks
 * in, a quick flash hands off to the reveal.
 */
function MatchingOverlay({ locked }: { locked: boolean }) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!locked) return;
    const t = setTimeout(() => setFlash(true), 250);
    return () => clearTimeout(t);
  }, [locked]);

  return (
    <div className="fixed inset-0 z-[110] bg-background flex flex-col items-center justify-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="relative h-64 w-64 flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute h-28 w-28 rounded-full border-2 border-pactara-purple/40"
            style={{ animation: `partner-radar 1.6s ease-out ${i * 0.5}s infinite` }}
          />
        ))}
        <span aria-hidden className="absolute h-40 w-40 rounded-full bg-pactara-purple/15 blur-2xl" />
        {FAST_ORBITERS.map((o, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute"
            style={
              {
                "--orbit-r": `${o.radius}px`,
                animation: `partner-orbit ${o.duration}s linear ${o.delay}s infinite`,
              } as React.CSSProperties
            }
          >
            <span className="block rounded-full shadow-md" style={{ width: o.size, height: o.size, background: o.color }} />
          </span>
        ))}
        <span
          className="relative h-24 w-24 rounded-full flex items-center justify-center shadow-partner-icon"
          style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
        >
          <Handshake size={38} color="white" strokeWidth={2} />
        </span>
      </div>
      <h2 className="mt-8 text-[28px] font-bold tracking-tight leading-tight">Matching you right now</h2>
      <p className="mt-2 text-[15px] font-medium" style={{ color: MUTED }}>
        Hold on — this only takes a moment.
      </p>
      <div className="relative mt-6 h-1 w-44 overflow-hidden rounded-full bg-pactara-purple/10">
        <span
          aria-hidden
          className="absolute inset-y-0 w-1/3 rounded-full bg-linear-to-r from-transparent via-pactara-purple to-transparent"
          style={{ animation: "partner-shimmer 1.1s ease-in-out infinite" }}
        />
      </div>
      {locked && flash && (
        <span
          aria-hidden
          className="pointer-events-none fixed inset-0 z-10 bg-white"
          style={{ animation: "partner-flash 600ms ease-out 1 forwards" }}
        />
      )}
    </div>
  );
}

function Shell({
  children,
  onBack,
  flush,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  flush?: boolean;
}) {
  if (flush) {
    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-background text-foreground">
        {children}
      </div>
    );
  }
  return (
    <div
      className="h-[100dvh] w-full flex flex-col px-6 pb-8 overflow-hidden bg-background text-foreground"
      style={{ paddingTop: 32 }}
    >
      <div className="flex items-center">
        {onBack && (
          <button onClick={onBack} aria-label="Back" className="-ml-1 p-1 shrink-0">
            <ChevronLeft size={22} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Footer({ children, error }: { children: React.ReactNode; error: string | null }) {
  return (
    <div className="pt-5 flex flex-col items-center gap-3">
      {error && (
        <div className="w-full rounded-xl bg-red-50 text-red-700 px-4 py-3 text-[14px]" role="alert">
          {error}
        </div>
      )}
      {children}
    </div>
  );
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-14 w-full rounded-2xl bg-pactara-purple text-[16px] font-semibold text-pactara-purple-foreground shadow-partner-cta transition-[transform,background-color,opacity] hover:bg-pactara-purple-deep active:scale-[0.98] disabled:opacity-60"
    >
      {label}
    </Button>
  );
}

function TextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[15px] font-medium py-1" style={{ color: MUTED }}>
      {label}
    </button>
  );
}

function Avatar({ person, size, className = "" }: { person: PartnerPerson; size: number; className?: string }) {
  return person.avatarUrl ? (
    <img
      src={person.avatarUrl}
      alt={person.name}
      width={size}
      height={size}
      className={`rounded-full object-cover ring-4 ring-white shadow-lg ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold ring-4 ring-white shadow-lg ${className}`}
      style={{ width: size, height: size, background: person.avatarColor, fontSize: size * 0.4 }}
    >
      {person.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function GoalCard({ label, goal, mine }: { label: string; goal: string | null; mine?: boolean }) {
  return (
    <div
      className="flex h-full flex-col rounded-2xl p-4"
      style={{ background: mine ? "#FBF9FF" : "#F5F3F0", border: mine ? "1px solid #EADDFF" : "1px solid transparent" }}
    >
      <div className="text-[12px] font-bold tracking-[0.14em]" style={{ color: LABEL }}>
        {label}
      </div>
      <div className="mt-1 text-[16px] font-semibold leading-snug break-words">{goal || "Showing up every day"}</div>
    </div>
  );
}
