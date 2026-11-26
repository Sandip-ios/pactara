import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Copy, Flag, Lock, MoreHorizontal } from "lucide-react";
import { newToastApi as toast } from "./new-toast";
import { cancelCrewJoinRequest, getCrewPreview, requestCrewJoin } from "@/lib/crew-join.functions";
import { Button } from "@/components/ui/button";
import { CrewAvatarOverlap } from "./CrewAvatars";
import { NewSheet, NewSheetRow } from "./NewSheet";
import { discoveryAvatars } from "./NewCrewDiscovery";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

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
    <div className="redesign-step3 fixed inset-0 bg-[var(--new-bg)] text-[var(--new-ink)]">
      <div ref={scrollRef} data-scroll-root className="h-full overflow-y-auto pb-[calc(24px+env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between bg-[var(--new-white)] px-4 pb-3 pt-new-top">
          <Button variant="ghost" size="icon" aria-label="Back" className="h-11 w-11 rounded-full bg-[var(--new-control)]" onClick={() => navigate({ to: "/crews" })}>
            <ChevronLeft className="!size-[22px]" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Crew options" className="h-11 w-11 rounded-full bg-[var(--new-control)]" onClick={() => { setCopied(false); setMenu(true); }}>
            <MoreHorizontal className="!size-[22px]" />
          </Button>
        </header>
        {isLoading && !data ? (
          <div className="mx-4 mt-4 h-40 animate-pulse rounded-[20px] bg-[var(--new-white)]" aria-label="Loading crew" />
        ) : !crew ? (
          <div className="m-4 rounded-[20px] bg-[var(--new-white)] p-6 text-center text-[16px] font-bold">
            {error ? "This crew is no longer available." : "This crew is no longer available."}
          </div>
        ) : (
          <main>
            <section className="bg-[var(--new-white)] px-4 pt-2 pb-4">
              <h1 className="text-[28px] font-extrabold leading-tight">{crew.name}</h1>
              <p className="mt-1 flex items-start gap-1.5 text-[13px] text-[var(--new-muted)]">
                <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
                <span>Private crew · {crew.memberCount} of {crew.limit} spots · started by {crew.ownerFirstName}</span>
              </p>
              {crew.about ? <p className="mt-3 text-[15px] leading-[1.5]">{crew.about}</p> : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="flex h-7 items-center rounded-full bg-[var(--new-control)] px-2.5 text-[13px] font-bold">{crew.daysPerWeek} days a week</span>
                <span className="flex h-7 items-center rounded-full bg-[var(--new-control)] px-2.5 text-[13px] font-bold">
                  {crew.crewStreak > 0 ? `${crew.crewStreak}-day crew streak` : "Crew streak starts today"}
                </span>
              </div>
            </section>
            <section className="mx-4 mt-4 rounded-[20px] bg-[var(--new-white)] p-4">
              <h2 className="text-[16px] font-extrabold">Members</h2>
              {crew.members.map((m, i) => (
                <div key={`${crew.id}-${i}`} className="flex items-center gap-3 border-b border-[var(--new-divider)] py-3 last:border-b-0 last:pb-0">
                  <CrewAvatarOverlap members={discoveryAvatars({ ...crew, members: [m] })} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold">{m.firstName}</p>
                    {m.isOwner ? <p className="mt-0.5 text-[13px] text-[var(--new-muted)]">Started the crew</p> : null}
                  </div>
                </div>
              ))}
            </section>
            <section className="mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] p-5 text-center">
              <span className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--new-handle)] text-[var(--new-muted)]">
                <Lock size={22} aria-hidden />
              </span>
              <p className="mt-3 text-[17px] font-extrabold">Only members see inside</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-[var(--new-muted)]">Check-ins, posts and chat are just for the crew.</p>
            </section>
            <div className="mt-3 px-4">
              {crew.requested ? (
                <>
                  <Button variant="ghost" disabled className="h-[52px] w-full rounded-[26px] bg-[var(--new-disabled-bg)] text-[17px] font-bold text-[var(--new-disabled-text)] disabled:opacity-100">Requested</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => void drop()} className="mt-2 h-11 w-full bg-transparent text-[15px] font-bold text-[var(--new-purple-text)] hover:bg-transparent hover:text-[var(--new-purple-text)]">Cancel request</Button>
                </>
              ) : full ? (
                <Button variant="ghost" disabled className="h-[52px] w-full rounded-[26px] bg-[var(--new-disabled-bg)] text-[17px] font-bold text-[var(--new-disabled-text)] disabled:opacity-100">Crew is full</Button>
              ) : (
                <Button variant="ghost" disabled={busy} onClick={() => void join()} className="h-[52px] w-full rounded-[26px] bg-[var(--new-purple)] text-[17px] font-bold text-[var(--new-white)] hover:bg-[var(--new-purple)] hover:text-[var(--new-white)] disabled:opacity-60">{busy ? "Asking…" : "Ask to join"}</Button>
              )}
              <p className="mt-2 px-2 text-center text-[13px] leading-[1.45] text-[var(--new-muted)]">
                {full && !crew.requested ? `${crew.ownerFirstName} runs this crew. When a spot opens, it shows up here again.` : `${crew.ownerFirstName} runs this crew and approves requests. You'll get a notification.`}
              </p>
            </div>
          </main>
        )}
      </div>

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
