import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Users, Calendar, Sunrise, CheckSquare, Flame, CheckCircle2 } from "lucide-react";
import { getGroupPreview, joinGroupById } from "@/lib/groups.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#6D28D9";
const MUTED = "#6B7280";
const PAGE_BG = "#F3F4F6";

export const Route = createFileRoute("/join/$groupId")({
  component: JoinPage,
  head: ({ params }) => {
    const ogImage = `https://pactara.lovable.app/api/public/og/invite/${params.groupId}`;
    const url = `https://pactara.lovable.app/join/${params.groupId}`;
    return {
      meta: [
        { title: "Add me on Pactara 💜" },
        { name: "description", content: "Add me on Pactara. Daily check-ins with friends keeping each other accountable." },
        { property: "og:title", content: "Add me on Pactara 💜" },
        { property: "og:description", content: "Add me on Pactara. Daily check-ins with friends keeping each other accountable." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Add me on Pactara 💜" },
        { name: "twitter:description", content: "Add me on Pactara. Daily check-ins with friends keeping each other accountable." },
        { name: "twitter:image", content: ogImage },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 text-center" style={{ background: PAGE_BG }}>
      <div>
        <div className="text-[18px] font-bold mb-2 text-black">This invite isn't available</div>
        <div className="text-[14px]" style={{ color: MUTED }}>{error.message}</div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: PAGE_BG }}>
      <div className="text-[16px] text-black">Invite not found.</div>
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
      toast.success(`Welcome to ${data.emoji ?? "🔥"} ${data.name}!`, {
        description: "You're in. Say hi to your crew.",
      });
      navigate({ to: "/home" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join the group");
      setJoining(false);
    }
  };

  const inviterName = data?.inviter?.fullName?.trim() || data?.inviter?.name || "Someone";
  const groupName = data?.name ?? "this group";
  const emoji = data?.emoji ?? "🔥";
  const goal = data?.goal ?? null;
  const duration = data?.durationDays ?? 30;
  const memberCount = data?.memberCount ?? 0;
  const members = data?.members ?? [];

  return (
    <div className="min-h-[100dvh] w-full" style={{ background: PAGE_BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="px-6 pt-5 pb-3 bg-white">
        <div className="text-[28px] font-black tracking-tight text-black">
          <span style={{ color: PURPLE }}>P</span>actara
        </div>
      </div>

      {/* Purple hero */}
      <div className="relative h-[180px] overflow-hidden" style={{ background: PURPLE }}>
        <div
          className="absolute -right-16 -top-10 h-[260px] w-[260px] rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <div
          className="absolute right-10 top-20 h-[120px] w-[120px] rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
      </div>

      <div className="px-4 -mt-16 pb-40">
        {/* Group card */}
        <div className="bg-white rounded-3xl shadow-sm p-5 relative">
          <div className="flex items-start gap-4">
            <div
              className="h-[88px] w-[88px] rounded-2xl flex items-center justify-center text-[44px] shrink-0 -mt-10 shadow-sm"
              style={{ background: PURPLE }}
            >
              {emoji}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">🥇</span>
                <h1 className="text-[20px] font-bold text-black leading-tight truncate">{groupName}</h1>
              </div>
              {goal && (
                <div className="mt-1 flex items-center gap-1.5 text-[14px]" style={{ color: MUTED }}>
                  <span>🎯</span>
                  <span className="truncate">{goal}</span>
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-[15px] leading-snug text-black">
            <span className="font-bold">{inviterName}</span>
            <span style={{ color: MUTED }}> invited you to join this accountability group on Pactara.</span>
          </p>

          <div className="mt-5 h-px w-full" style={{ background: "#E5E7EB" }} />

          <div className="mt-4 grid grid-cols-2">
            <div className="flex flex-col items-center text-center border-r" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex items-center gap-2">
                <Users size={18} color={PURPLE} />
                <span className="text-[18px] font-bold text-black">{memberCount}</span>
              </div>
              <div className="text-[13px] mt-1" style={{ color: MUTED }}>members</div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-2">
                <Calendar size={18} color={PURPLE} />
                <span className="text-[18px] font-bold text-black">{duration}d</span>
              </div>
              <div className="text-[13px] mt-1" style={{ color: MUTED }}>challenge</div>
            </div>
          </div>

          {members.length > 0 && (
            <>
              <div className="mt-5 h-px w-full" style={{ background: "#E5E7EB" }} />
              <div className="mt-4">
                <div className="text-[11px] font-semibold tracking-wider" style={{ color: "#9CA3AF" }}>
                  ALREADY IN THIS GROUP
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  {members.slice(0, 8).map((m) => (
                    <div key={m.id} className="flex flex-col items-center w-[64px]">
                      <div
                        className="h-14 w-14 rounded-full flex items-center justify-center text-[18px] font-bold overflow-hidden"
                        style={{ background: m.avatarColor || PURPLE, color: "#fff" }}
                      >
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                        ) : (
                          (m.name || "U").slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="mt-1.5 text-[13px] text-black truncate max-w-full">{m.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* How it works */}
        <div className="mt-4 bg-white rounded-3xl shadow-sm p-5">
          <div className="text-[11px] font-semibold tracking-wider" style={{ color: "#9CA3AF" }}>
            HOW IT WORKS
          </div>
          <div className="mt-4 space-y-4">
            <HowRow
              icon={<Users size={20} color={PURPLE} />}
              iconBg="rgba(124,58,237,0.12)"
              title="Join a small group"
              body="Up to 8 people, all chasing the same goal."
            />
            <HowRow
              icon={<Sunrise size={20} color="#F59E0B" />}
              iconBg="rgba(245,158,11,0.15)"
              title="Morning ritual"
              body="Every morning, tell your group what you're doing today. Your crew sees it — and now they're watching."
            />
            <HowRow
              icon={<CheckSquare size={20} color="#fff" />}
              iconBg="#10B981"
              title="Check in every day"
              body="Come back at the end of the day. A photo, a note — whatever feels right. Your group will notice."
            />
            <HowRow
              icon={<Flame size={20} color="#F97316" />}
              iconBg="rgba(249,115,22,0.15)"
              title="Build momentum together"
              body="Streaks, reactions, and real accountability."
            />
          </div>
        </div>

        <div className="mt-6 text-center text-[13px]" style={{ color: MUTED }}>
          Free to join · No credit card required
        </div>
        {!isSignedIn && authReady && (
          <div className="mt-2 text-center text-[13px]" style={{ color: MUTED }}>
            Already have an account?{" "}
            <Link to="/auth" className="font-semibold" style={{ color: PURPLE }}>
              Sign in ›
            </Link>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl px-4 py-3 text-[14px] text-center" style={{ background: "rgba(239,68,68,0.1)", color: "#B91C1C" }}>
            {error}
          </div>
        )}
      </div>

      {/* Sticky bottom Join button */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          background: "linear-gradient(to top, rgba(243,244,246,1) 60%, rgba(243,244,246,0))",
        }}
      >
        <button
          onClick={handleJoin}
          disabled={isLoading || joining || !authReady}
          className="w-full py-4 rounded-2xl text-[17px] font-bold text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-60 shadow-lg"
          style={{ background: PURPLE, boxShadow: `0 10px 24px -8px ${PURPLE_DEEP}` }}
        >
          <CheckCircle2 size={20} />
          <span>
            {joining ? "Joining…" : `Join ${emoji} ${groupName}`}
          </span>
        </button>
      </div>
    </div>
  );
}

function HowRow({
  icon,
  iconBg,
  title,
  body,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-bold text-black">{title}</div>
        <div className="text-[14px] leading-snug mt-0.5" style={{ color: MUTED }}>{body}</div>
      </div>
    </div>
  );
}
