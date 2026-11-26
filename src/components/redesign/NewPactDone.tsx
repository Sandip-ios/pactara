import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { newToastApi as toast } from "./new-toast";
import { getGroupsToday } from "@/lib/group-today.functions";
import { markPactSeen } from "@/lib/pact-cycle.functions";
import { pactDoneSubtitle, shareResultText } from "@/lib/pact-cycle";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { CrewAvatar } from "./CrewAvatars";
import { pactStatusOptions } from "./pact-query";

const INK = "#1C1917", MUTED = "#57534E";
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export function NewPactDone({ groupId }: { groupId: string }) {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  const { data: status } = useQuery(pactStatusOptions(groupId));
  const { data: today } = useQuery({ queryKey: ["groups-today"], queryFn: () => getGroupsToday(), staleTime: 30_000 });
  const mark = useServerFn(markPactSeen);
  const group = today?.groups.find((g) => g.id === groupId);

  useEffect(() => {
    if (!status?.done || status.doneSeen) return;
    void mark({ data: { groupId, pactStart: status.start, kind: "done" } })
      .then(() => queryClient.setQueryData(pactStatusOptions(groupId).queryKey, { ...status, doneSeen: true }))
      .catch(() => undefined);
  }, [status, groupId, mark, queryClient]);

  if (!status || !group) return <div className="fixed inset-0" style={{ background: "#F4F2EF" }} aria-label="Loading" />;
  const me = group.members.find((m) => m.isYou);
  const myShown = me ? status.shown[me.userId] ?? 0 : 0;
  const owner = group.members.find((m) => m.userId === status.ownerId);
  const ownerName = owner ? first(owner.name) : "The owner";
  const rows = [...group.members].sort((a, b) => (status.shown[b.userId] ?? 0) - (status.shown[a.userId] ?? 0));

  const share = async () => {
    const text = shareResultText(myShown, status.duration, group.name);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Copied to share."); }
    } catch { /* closed the share sheet */ }
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "linear-gradient(180deg, #F3EEFF 0px, #F4F2EF 360px)", color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <main ref={scrollRef} data-scroll-root className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 pb-6 pt-new-top">
        <div className="mx-auto mt-6 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white">
          <Trophy size={32} style={{ color: "#C2410C" }} aria-hidden />
        </div>
        <p className="mt-5 text-center text-[13px] font-extrabold uppercase" style={{ color: "#7C3AED", letterSpacing: "0.5px" }}>{group.name} · {status.duration}-day pact done</p>
        <h1 className="mt-2 text-center text-[28px] font-extrabold leading-tight">You showed up {myShown} of {status.duration} days</h1>
        <p className="mt-2 text-center text-[15px] leading-[1.45]" style={{ color: MUTED }}>{pactDoneSubtitle(status.longest, status.together)}</p>
        <section className="mt-6 rounded-[20px] bg-white px-4">
          {rows.map((m, i) => {
            const n = status.shown[m.userId] ?? 0;
            return (
              <div key={m.userId} className="flex items-center gap-3 py-3" style={i ? { borderTop: "1px solid #F4F2EF" } : undefined}>
                <CrewAvatar member={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl, avatarColor: m.avatarColor }} size={36} />
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{m.isYou ? "You" : first(m.name)}</span>
                <span className="text-[15px] font-extrabold" style={{ color: n >= status.duration ? "#16A34A" : INK }}>{n} of {status.duration}</span>
              </div>
            );
          })}
        </section>
      </main>
      <div className="shrink-0 px-6" style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 16px) + 24px)" }}>
          <button type="button" onClick={() => status.isOwner ? navigate({ to: "/crews/$groupId/next-pact", params: { groupId } }) : navigate({ to: "/crews/$groupId", params: { groupId } })} className="h-[52px] w-full rounded-[26px] text-[17px] font-bold text-white" style={{ background: "#7C3AED" }}>
            {status.isOwner ? "Start the next pact" : "Back to crew"}
          </button>
          <button type="button" onClick={() => void share()} className="mt-3 h-[52px] w-full rounded-[26px] text-[17px] font-bold" style={{ background: "#EDE4FF", color: "#6D28D9" }}>Share your result</button>
          <p className="mt-3 px-2 text-center text-[13px] leading-[1.45]" style={{ color: MUTED }}>
            {status.isOwner ? `You run ${group.name}. To end the crew instead, go to Crew settings.` : `${ownerName} runs ${group.name} and decides what's next.`}
          </p>
      </div>
    </div>
  );
}
