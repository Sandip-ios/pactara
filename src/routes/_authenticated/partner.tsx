import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Handshake } from "lucide-react";
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

function PartnerPage() {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
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
  const soloGroupId = solo ?? data?.soloGroupId ?? null;

  const onFind = () =>
    run(async () => {
      const res = await search({ data: { soloGroupId } });
      if (res.matched) setJustMatched(true);
    });

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

  // Match found, waiting on this person.
  if (data.status === "pending" && p && !p.iAccepted) {
    return (
      <Shell onBack={goHome}>
        {justMatched && <ConfettiBurst durationMs={2200} />}
        <div className="flex-1 overflow-y-auto flex flex-col items-center text-center">
          <div className="mt-4 text-[48px] leading-none">🔥</div>
          <h1 className="mt-4 text-[34px] font-bold tracking-tight leading-[1.05]">You've got a partner</h1>
          <p className="mt-2 text-[17px]" style={{ color: MUTED }}>
            Meet {p.partner.name}.
          </p>
          <Avatar person={p.partner} size={104} className="mt-6" />
          <div className="mt-7 w-full flex flex-col gap-2 text-left">
            <GoalCard label={`${p.partner.name.toUpperCase()}'S GOAL`} goal={p.partner.goal} />
            <GoalCard label="YOUR GOAL" goal={data.myGoal} mine />
          </div>
          <p className="mt-6 text-[17px] font-semibold">{p.durationDays} days of showing up together.</p>
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

  // In line for a partner.
  if (data.status === "waiting") {
    return (
      <Shell onBack={goHome}>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="relative h-24 w-24 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: PURPLE_SOFT }} />
            <span
              className="relative h-20 w-20 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)` }}
            >
              <Handshake size={34} color="white" />
            </span>
          </div>
          <h1 className="mt-7 text-[32px] font-bold tracking-tight leading-tight">
            {data.released ? "We're still finding your person" : "We're finding your person"}
          </h1>
          <p className="mt-3 text-[16px] leading-[1.45] max-w-[320px]" style={{ color: MUTED }}>
            {data.released
              ? "We'll let you know when your next match is ready."
              : "You're in line for an accountability partner. We'll let you know as soon as someone's ready to show up with you."}
          </p>
          <div
            className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold"
            style={{ background: PURPLE_SOFT, color: PURPLE_DEEP }}
          >
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: PURPLE }} />
            Partner search active
          </div>
          {data.myGoal && (
            <div className="mt-6 w-full text-left">
              <GoalCard label="YOUR GOAL" goal={data.myGoal} mine />
            </div>
          )}
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
    <Shell onBack={goHome}>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-2 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-linear-to-br from-pactara-purple to-pactara-purple-deep text-pactara-purple-foreground shadow-partner-icon motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
          <Handshake aria-hidden="true" size={42} strokeWidth={1.9} />
        </span>
        <h1 className="mt-10 max-w-[330px] text-[32px] font-bold leading-[1.1] text-foreground">
          Find an accountability partner
        </h1>
        <p className="mt-4 max-w-[300px] text-[17px] font-medium leading-relaxed text-muted-foreground">
          We'll pair you with someone who's ready to show up too.
        </p>
      </div>
      <Footer error={error}>
        <PrimaryButton label={busy ? "Finding your partner…" : "Find me a partner"} onClick={onFind} disabled={busy} />
      </Footer>
    </Shell>
  );
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
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
      className="rounded-2xl p-4"
      style={{ background: mine ? "#FBF9FF" : "#F5F3F0", border: mine ? "1px solid #EADDFF" : "1px solid transparent" }}
    >
      <div className="text-[12px] font-bold tracking-[0.14em]" style={{ color: LABEL }}>
        {label}
      </div>
      <div className="mt-1 text-[16px] font-semibold leading-snug break-words">{goal || "Showing up every day"}</div>
    </div>
  );
}
