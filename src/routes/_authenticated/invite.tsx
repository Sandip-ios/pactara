import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Copy, Check } from "lucide-react";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { shareNativeOrWeb, hapticLight } from "@/lib/native";

export const Route = createFileRoute("/_authenticated/invite")({
  component: InvitePage,
});

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const PURPLE_SOFT = "#F3EEFF";
const TEXT_MUTED = "#6B6660";

function InvitePage() {
  const { data: statusData, isLoading } = useQuery({
    queryKey: ["my-group-status"],
    queryFn: () => getMyGroupStatus(),
  });
  const status = statusData ?? { hasGroup: false as const, memberCount: 0, firstName: "there", group: null };
  const router = useRouter();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && status.group) {
      setInviteLink(`${window.location.origin}/join/${status.group.id}`);
    }
  }, [status.group]);

  const handleInvite = async () => {
    if (!status.group) return;
    void hapticLight();
    const result = await shareNativeOrWeb({
      title: `Join my ${status.group.name}`,
      text: `Join me on Pactara — we're keeping each other accountable.`,
      url: inviteLink,
    });
    if (result === "clipboard") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const dismiss = () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("invite-dismissed", "1");
    }
    router.invalidate();
    navigate({ to: "/home", replace: true });
  };

  const groupName = status.group?.name ?? "your Crew";
  const emoji = status.group?.emoji ?? "🔥";

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col px-6 pt-14 pb-10"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: "#0A0A0A" }}
    >
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        {/* Avatar cluster */}
        <div className="flex items-center -space-x-3 mb-10">
          {[0.35, 0.55, 0.9].map((opacity, i) => (
            <div
              key={i}
              className="h-16 w-16 rounded-full flex items-center justify-center text-white text-2xl"
              style={{ background: PURPLE, opacity }}
            >
              👤
            </div>
          ))}
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center text-3xl border-2 border-dashed"
            style={{ background: "#F3F2F0", color: PURPLE, borderColor: "#D6D3D1" }}
          >
            +
          </div>
        </div>

        <h1 className="text-[34px] font-bold leading-[1.1] tracking-tight max-w-[340px]">
          Invite friends to <span>{emoji}</span> {groupName}
        </h1>
        <p className="mt-4 text-[16px] max-w-[300px]" style={{ color: TEXT_MUTED }}>
          Groups with friends check in 3× more often.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleInvite}
          className="w-full rounded-2xl py-5 flex items-center justify-center gap-2 text-[17px] font-semibold text-white transition-transform active:scale-[0.99]"
          style={{
            background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
            boxShadow: "0 14px 34px -14px rgba(124, 58, 237, 0.55)",
          }}
        >
          <UserPlus size={18} />
          Invite friends
        </button>
        <button
          onClick={handleCopy}
          className="w-full rounded-2xl py-5 flex items-center justify-center gap-2 text-[17px] font-semibold transition-transform active:scale-[0.99]"
          style={{ background: PURPLE_SOFT, color: PURPLE }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? "Link copied" : "Copy link"}
        </button>
        <button
          onClick={dismiss}
          className="mt-3 text-[15px] font-medium text-center"
          style={{ color: TEXT_MUTED }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
