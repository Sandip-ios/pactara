import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Copy, Flag, Lock, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cancelCrewJoinRequest, getCrewPreview, requestCrewJoin } from "@/lib/crew-join.functions";
import { Button } from "@/components/ui/button";
import { CrewAvatarOverlap } from "./CrewAvatars";
import { NewSheet, NewSheetRow } from "./NewSheet";
import { discoveryAvatars } from "./NewCrewDiscovery";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

const INK = "#1C1917";
const MUTED = "#57534E";
const SOFT = "#F4F2EF";
const LAV = "#EDE4FF";
const LAV_INK = "#6D28D9";
const PURPLE = "#7C3AED";

export function NewCrewPreview({ groupId }: { groupId: string }) {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  useStatusBarScrollToTop();
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crew-preview", groupId],
    queryFn: () => getCrewPreview({ data: { groupId } }),
    staleTime: 15_000,
  });
  const ask = useServerFn(requestCrewJoin);
  const cancel = useServerFn(cancelCrewJoinRequest);
  const crew = data?.crew ?? null;
  const full = crew ? crew.memberCount >= crew.limit : false;
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/crews/${groupId}/preview`;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["crew-preview", groupId] });
    await queryClient.invalidateQueries({ queryKey: ["find-crews"] });
    await queryClient.invalidateQueries({ queryKey: ["crew-join-overview"] });
  };

  const join = async () => {
    if (!crew) return;
    setBusy(true);
    try {
      await ask({ data: { groupId: crew.id } });
      toast.success(`Asked to join ${crew.name}.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't ask right now. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const drop = async () => {
    if (!crew?.requestId) return;
    setBusy(true);
    try {
      await cancel({ data: { requestId: crew.requestId } });
      toast.success(`Request withdrawn from ${crew.name}.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't withdraw your request. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="redesign-step3 fixed inset-0 bg-[#F5F2EE] text-[#1C1917]">
      <div ref={scrollRef} data-scroll-root className="h-full overflow-y-auto pb-[calc(150px+env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between bg-white px-4 pb-3 pt-new-top">
          <Button variant="ghost" size="icon" aria-label="Back" className="h-11 w-11 rounded-full bg-[#F4F2EF]" onClick={() => navigate({ to: "/crews" })}>
            <ChevronLeft className="!size-[22px]" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Crew options" className="h-11 w-11 rounded-full bg-[#F4F2EF]" onClick={() => { setCopied(false); setMenu(true); }}>
            <MoreHorizontal className="!size-[22px]" />
          </Button>
        </header>

        {isLoading && !data ? (
          <div className="mx-4 mt-4 h-40 animate-pulse rounded-[20px] bg-white" aria-label="Loading crew" />
        ) : !crew ? (
          <div className="m-4 rounded-[20px] bg-white p-6 text-center text-[16px] font-bold">
            {error ? "This crew is no longer available." : "This crew is no longer available."}
          </div>
        ) : (
          <main>
            <h1 className="px-4 pt-2 text-[28px] font-extrabold leading-tight" style={{ color: INK }}>{crew.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 px-4 text-[13px]" style={{ color: MUTED }}>
              <Lock size={13} aria-hidden /> Private crew · {crew.memberCount} of {crew.limit} spots · started by {crew.ownerFirstName}
            </p>
            {crew.about ? <p className="mt-3 px-4 text-[15px] leading-[1.5]" style={{ color: INK }}>{crew.about}</p> : null}
            <div className="mt-3 flex flex-wrap gap-1.5 px-4">
              <span className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold" style={{ background: SOFT, color: INK }}>
                <Lock size={12} aria-hidden /> Private
              </span>
              <span className="flex h-7 items-center rounded-full px-2.5 text-[13px] font-bold" style={{ background: SOFT, color: INK }}>
                {crew.daysPerWeek} days a week
              </span>
              {crew.crewStreak > 0 ? (
                <span className="flex h-7 items-center rounded-full px-2.5 text-[13px] font-bold" style={{ background: SOFT, color: INK }}>
                  {crew.crewStreak}-day crew streak
                </span>
              ) : null}
            </div>

            <h2 className="px-4 pb-2 pt-6 text-[12px] font-extrabold tracking-[.6px]" style={{ color: MUTED }}>MEMBERS</h2>
            <section className="mx-4 overflow-hidden rounded-[20px] bg-white px-4">
              {crew.members.map((m, i) => (
                <div key={`${crew.id}-${i}`} className="flex items-center gap-3 border-b border-[#F0EDE9] py-3 last:border-b-0">
                  <CrewAvatarOverlap members={discoveryAvatars({ ...crew, members: [m] })} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold" style={{ color: INK }}>{m.firstName}</p>
                    {m.isOwner ? <p className="mt-0.5 text-[13px]" style={{ color: MUTED }}>Started the crew</p> : null}
                  </div>
                </div>
              ))}
            </section>

            <section className="mx-4 mt-3 rounded-[20px] bg-white p-5 text-center">
              <span className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border" style={{ borderColor: "#E7E3DE", color: MUTED }}>
                <Lock size={22} aria-hidden />
              </span>
              <p className="mt-3 text-[17px] font-extrabold" style={{ color: INK }}>Only members see inside</p>
              <p className="mt-1 text-[14px] leading-[1.45]" style={{ color: MUTED }}>Check-ins, posts and chat are just for the crew.</p>
            </section>
          </main>
        )}
      </div>

      {crew ? (
        <footer className="absolute inset-x-0 bottom-0 bg-[#F5F2EE] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {crew.requested ? (
            <>
              <Button variant="ghost" disabled className="h-[52px] w-full rounded-[26px] text-[17px] font-bold" style={{ background: SOFT, color: MUTED }}>
                Requested
              </Button>
              <button type="button" disabled={busy} onClick={() => void drop()} className="mx-auto mt-2 flex h-11 text-[15px] font-bold disabled:opacity-60" style={{ color: INK }}>
                Cancel request
              </button>
            </>
          ) : full ? (
            <>
              <Button variant="ghost" disabled className="h-[52px] w-full rounded-[26px] text-[17px] font-bold" style={{ background: SOFT, color: MUTED }}>
                Crew is full
              </Button>
              <p className="mt-2 px-2 text-center text-[13px] leading-[1.45]" style={{ color: MUTED }}>
                {crew.ownerFirstName} runs this crew. When a spot opens, it shows up here again.
              </p>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void join()}
                className="h-[52px] w-full rounded-[26px] text-[17px] font-bold text-white disabled:opacity-60"
                style={{ background: PURPLE }}
              >
                {busy ? "Asking…" : "Ask to join"}
              </Button>
              <p className="mt-2 px-2 text-center text-[13px] leading-[1.45]" style={{ color: MUTED }}>
                {crew.ownerFirstName} runs this crew and approves requests. You'll get a notification.
              </p>
            </>
          )}
        </footer>
      ) : null}

      <NewSheet open={menu} onOpenChange={setMenu} title={crew?.name ?? "Crew"} subtitle="You're not in this crew yet.">
        <div>
          <NewSheetRow
            simple
            title={copied ? "Copied!" : "Copy crew link"}
            leading={<Copy size={22} />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                toast.error("Couldn't copy. Use the link in your browser bar.");
              }
            }}
          />
          <NewSheetRow simple title="Report this crew" leading={<Flag size={22} />} onClick={() => { setMenu(false); void navigate({ to: "/support" }); }} />
        </div>
      </NewSheet>
    </div>
  );
}
