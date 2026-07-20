import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { X, Heart } from "lucide-react";
import { getGroupPreview, joinGroupById } from "@/lib/groups.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DARK_BG = "#121214";
const CARD_BG = "#1C1C1F";
const AMBER = "#FDE047";
const MUTED = "#9CA3AF";

export const Route = createFileRoute("/join/$groupId")({
  component: JoinPage,
  head: ({ params }) => ({
    meta: [
      { title: "Accept your invite to my Pactara group!" },
      { name: "description", content: "Add me on Pactara. Daily check-ins with friends keeping each other accountable." },
      { property: "og:title", content: "Accept your invite to my Pactara group!" },
      { property: "og:description", content: "Add me on Pactara. Daily check-ins with friends keeping each other accountable." },
    ],
    links: [{ rel: "canonical", href: `/join/${params.groupId}` }],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 text-center" style={{ background: DARK_BG }}>
      <div style={{ color: "#fff" }}>
        <div className="text-[18px] font-bold mb-2">This invite isn't available</div>
        <div className="text-[14px]" style={{ color: MUTED }}>{error.message}</div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: DARK_BG }}>
      <div className="text-[16px]" style={{ color: "#fff" }}>Invite not found.</div>
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
  const inviterInitials = inviterName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "P";

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 py-8" style={{ background: DARK_BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-[360px] rounded-[32px] p-6 relative" style={{ background: CARD_BG }}>
        {/* Center avatar */}
        <div className="flex flex-col items-center text-center">
          <div
            className="h-[140px] w-[140px] rounded-full flex items-center justify-center text-[56px] font-bold mb-6"
            style={{
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
            }}
          >
            {inviterInitials}
          </div>

          <h1 className="text-[22px] font-bold leading-tight mb-3" style={{ color: "#fff" }}>
            Accept your invite to my Pactara group!
          </h1>
          <p className="text-[15px] leading-snug" style={{ color: MUTED }}>
            {inviterName} invited you to join{" "}
            <span className="font-semibold" style={{ color: "#fff" }}>{groupName}</span>.
          </p>

          <button
            onClick={handleJoin}
            disabled={isLoading || joining || !authReady}
            className="mt-8 px-14 py-3.5 rounded-full text-[17px] font-bold transition-transform active:scale-[0.98] disabled:opacity-60 min-w-[200px]"
            style={{
              background: AMBER,
              color: "#000",
            }}
          >
            {joining ? "Joining…" : isSignedIn ? "Join group" : "Open"}
          </button>
        </div>

        {/* Members preview */}
        {data && data.members && data.members.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {(data.members ?? []).slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-bold overflow-hidden border-2 border-[#1C1C1F]"
                style={{ background: m.avatarColor || "#7C3AED", color: "#fff", marginLeft: "-8px" }}
              >
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  (m.name || "U").slice(0, 1).toUpperCase()
                )}
              </div>
            ))}
            <span className="text-[13px] ml-1" style={{ color: MUTED }}>
              {data.memberCount ?? 0} in this group
            </span>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl px-4 py-3 text-[14px] text-center" style={{ background: "rgba(239,68,68,0.15)", color: "#FCA5A5" }}>
            {error}
          </div>
        )}

        {/* Bottom attribution */}
        <div className="mt-8 rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div>
            <div className="text-[15px] font-semibold flex items-center gap-1.5" style={{ color: "#fff" }}>
              Add me on Pactara <Heart size={14} fill={AMBER} color={AMBER} />
            </div>
            <div className="text-[13px]" style={{ color: MUTED }}>
              pactara.app
            </div>
          </div>
          <div className="text-[24px] font-black tracking-tight" style={{ color: "#7C3AED" }}>
            P
          </div>
        </div>
      </div>

      {!isSignedIn && authReady && (
        <div className="mt-6 text-center text-[13px]" style={{ color: MUTED }}>
          Already have an account?{" "}
          <button
            onClick={() => {
              if (typeof sessionStorage !== "undefined") sessionStorage.setItem("pending-invite-group", groupId);
              navigate({ to: "/login" });
            }}
            className="font-semibold underline"
            style={{ color: "#fff" }}
          >
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}
