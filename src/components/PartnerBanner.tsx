import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Handshake } from "lucide-react";
import { getPartnerState } from "@/lib/partners.functions";

/** Small Home card that keeps the partner search visible without blocking the app. */
export function PartnerBanner() {
  const navigate = useNavigate();
  const fetchState = useServerFn(getPartnerState);
  const { data } = useQuery({ queryKey: ["partner-state"], queryFn: () => fetchState(), staleTime: 30_000 });
  if (!data) return null;

  const p = data.partnership;
  let title: string | null = null;
  let body = "";
  if (data.status === "waiting") {
    title = "Finding your partner";
    body = "We'll let you know the moment we find someone.";
  } else if (data.status === "pending" && p && !p.iAccepted) {
    title = "You've got a partner 🔥";
    body = `Meet ${p.partner.name}.`;
  } else if (data.status === "pending" && p) {
    title = `Waiting for ${p.partner.name}`;
    body = "You're in. We'll let you know when they accept.";
  } else if (data.status === "active" && p?.partnerInactive) {
    title = `${p.partner.name} hasn't been active lately`;
    body = "Want us to find you another partner?";
  }
  if (!title) return null;

  return (
    <button
      onClick={() => navigate({ to: "/partner", search: { solo: undefined } })}
      className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-2xl bg-card px-4 py-3 flex items-center gap-3 text-left shadow-sm border border-border"
    >
      <span className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
        <Handshake size={20} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold text-foreground truncate">{title}</span>
        <span className="block text-[13px] text-muted-foreground truncate">{body}</span>
      </span>
      <ChevronRight size={18} className="text-muted-foreground" />
    </button>
  );
}
