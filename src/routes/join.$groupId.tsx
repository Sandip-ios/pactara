import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Users, CalendarDays, CheckCircle2, ChevronRight, Sunrise, CheckSquare, Flame } from "lucide-react";
import { getGroupPreview, joinGroupById } from "@/lib/groups.functions";
import { supabase } from "@/integrations/supabase/client";

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const PURPLE_SOFT = "#EFE6FF";
const BG = "#F5F2EE";
const TEXT_MUTED = "#6B6660";

export const Route = createFileRoute("/join/$groupId")({
  component: JoinPage,
  head: ({ params }) => ({
    meta: [
      { title: "Join an accountability group on Pactara" },
      { name: "description", content: "You've been invited to join an accountability group on Pactara." },
      { property: "og:title", content: "Join my accountability group on Pactara" },
      { property: "og:description", content: "Daily check-ins with friends keeping each other accountable." },
    ],
    links: [{ rel: "canonical", href: `/join/${params.groupId}` }],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 text-center" style={{ background: BG }}>
      <div>
        <div className="text-[18px] font-bold mb-2">This invite isn't available</div>
        <div className="text-[14px] text-neutral-500">{error.message}</div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: BG }}>
      <div className="text-[16px]">Invite not found.</div>
    </div>
  ),
});

function JoinPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useServerFn(joinGroupById);
  const fetchPreview = useServerFn(getGroupPreview);

  const { data, isLoading } = useQuery({
    queryKey: ["group-preview", groupId],
    queryFn: () => fetchPreview({ data: { groupId } }),
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: s }) => {
      if (!mounted) return;
      setIsSignedIn(!!s.session);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleJoin = async () => {
    if (!data || joining) return;
    setError(null);
    if (!isSignedIn) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("pending-invite-group", groupId);
      }
      navigate({ to: "/signup" });
      return;
    }
    try {
      setJoining(true);
      await join({ data: { groupId } });
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("active-group-id", groupId);
      }
      router.invalidate();
      navigate({ to: "/home" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join the group");
      setJoining(false);
    }
  };

  const inviterName = data?.inviter?.fullName?.trim() || data?.inviter?.name || "Someone";
  const groupName = data?.name ?? "this group";
  const emoji = data?.emoji ?? "🔥";

  return (
    <div className="min-h-[100dvh] w-full pb-32" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <header className="bg-white px-6 pt-5 pb-4 flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center text-[18px]"
          style={{ background: PURPLE }}
        >
          🔥
        </div>
        <div className="text-[22px] font-black tracking-tight">Pactara</div>
      </header>

      {/* Purple banner */}
      <div className="relative h-[180px] overflow-hidden" style={{ background: PURPLE }}>
        <div className="absolute -right-10 -top-10 h-[220px] w-[220px] rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="absolute right-20 top-20 h-[140px] w-[140px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>

      {/* Card */}
      <section className="px-4 -mt-16 relative z-10">
        <div className="rounded-2xl bg-white p-5" style={{ boxShadow: "0 10px 30px -16px rgba(0,0,0,0.15)" }}>
          <div className="flex items-start gap-3 -mt-12">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center text-[36px] border-4 border-white shrink-0"
              style={{ background: PURPLE }}
            >
              {emoji}
            </div>
            <div className="flex-1 pt-12 min-w-0">
              <div className="text-[20px] font-extrabold leading-tight truncate">
                🥇 {groupName}
              </div>
              <div className="text-[13px] flex items-center gap-1 mt-1" style={{ color: TEXT_MUTED }}>
                <span>🎯</span>
                <span className="truncate">{groupName.replace(/\s*Crew$/i, "")}</span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[15px] leading-snug">
            <span className="font-bold">{inviterName}</span>{" "}
            <span style={{ color: TEXT_MUTED }}>
              invited you to join this accountability group on Pactara.
            </span>
          </p>

          <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2">
            <div className="flex flex-col items-center gap-1 border-r border-neutral-100">
              <div className="flex items-center gap-1.5">
                <Users size={16} style={{ color: PURPLE }} />
                <span className="font-bold text-[16px]">{data?.memberCount ?? 0}</span>
              </div>
              <div className="text-[12px]" style={{ color: TEXT_MUTED }}>members</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <CalendarDays size={16} style={{ color: PURPLE }} />
                <span className="font-bold text-[16px]">30d</span>
              </div>
              <div className="text-[12px]" style={{ color: TEXT_MUTED }}>challenge</div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-neutral-100">
            <div className="text-[11px] font-semibold tracking-wider mb-3" style={{ color: "#9A9690" }}>
              ALREADY IN THIS GROUP
            </div>
            <div className="flex items-start gap-4 overflow-x-auto">
              {(data?.members ?? []).slice(0, 8).map((m) => (
                <div key={m.id} className="flex flex-col items-center gap-1 shrink-0 w-16">
                  <div
                    className="h-14 w-14 rounded-full flex items-center justify-center text-white text-[20px] font-bold overflow-hidden"
                    style={{ background: m.avatarColor || PURPLE }}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      (m.name || "U").slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="text-[12px] text-center truncate w-full">{m.name}</div>
                </div>
              ))}
              {isLoading && <div className="h-14 w-14 rounded-full bg-neutral-100 animate-pulse" />}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl bg-white p-5 mt-4">
          <div className="text-[11px] font-semibold tracking-wider mb-4" style={{ color: "#9A9690" }}>
            HOW IT WORKS
          </div>
          <HowRow
            icon={<Users size={20} className="text-[#7C3AED]" />}
            bg="#F1E9FF"
            title="Join a small group"
            text="Up to 8 people, all chasing the same fitness goal."
          />
          <HowRow
            icon={<Sunrise size={20} className="text-[#D97706]" />}
            bg="#FEE9C9"
            title="Morning ritual"
            text="Every morning, tell your group what you're doing today. Your crew sees it — and now they're watching."
          />
          <HowRow
            icon={<CheckSquare size={20} className="text-white" />}
            bg="#22C55E"
            title="Check in every day"
            text="Come back at the end of the day. A photo, a note — whatever feels right. Your group will notice."
          />
          <HowRow
            icon={<Flame size={20} className="text-[#EA580C]" />}
            bg="#FEE2C7"
            title="Build momentum together"
            text="Streaks, reactions, and real accountability."
          />
        </div>

        {!isSignedIn && authReady && (
          <div className="text-center mt-5 text-[13px]" style={{ color: TEXT_MUTED }}>
            Free to join · No credit card required
            <div className="mt-1">
              Already have an account?{" "}
              <button onClick={() => {
                if (typeof sessionStorage !== "undefined") sessionStorage.setItem("pending-invite-group", groupId);
                navigate({ to: "/login" });
              }} className="font-semibold inline-flex items-center gap-0.5" style={{ color: PURPLE }}>
                Sign in <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-[14px]">{error}</div>
        )}
      </section>

      {/* Floating CTA */}
      <div className="fixed left-0 right-0 bottom-0 px-4 pt-8 pb-6 pointer-events-none z-50" style={{ background: "linear-gradient(180deg, rgba(245,242,238,0) 0%, rgba(245,242,238,0.9) 40%, rgba(245,242,238,1) 100%)" }}>
        <button
          onClick={handleJoin}
          disabled={isLoading || joining || !authReady}
          className="pointer-events-auto w-full rounded-2xl py-4 flex items-center justify-center gap-2 text-[17px] font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
          style={{
            background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
            boxShadow: "0 14px 34px -14px rgba(124, 58, 237, 0.55)",
          }}
        >
          <CheckCircle2 size={18} />
          {joining ? "Joining…" : `Join ${emoji} ${groupName}`}
        </button>
      </div>
    </div>
  );
}

function HowRow({ icon, bg, title, text }: { icon: React.ReactNode; bg: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold leading-tight">{title}</div>
        <div className="text-[13px] mt-0.5" style={{ color: TEXT_MUTED }}>{text}</div>
      </div>
    </div>
  );
}
