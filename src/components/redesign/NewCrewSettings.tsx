import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Crown, MoreHorizontal, User, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCrewManagement, manageCrewMember, saveCrewSettings } from "@/lib/crew-management.functions";
import { joinedCrewDate } from "@/lib/crew-management";
import { stabilizeSignedUrls } from "@/lib/stable-urls";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { CrewAvatar } from "./CrewAvatars";
import { NewSheet, NewSheetChevron, NewSheetRow } from "./NewSheet";
import { NewConfirm } from "./NewConfirm";

export const crewManagementOptions = (groupId: string) => queryOptions({ queryKey: ["crew-management", groupId], queryFn: async () => stabilizeSignedUrls(await getCrewManagement({ data: { groupId } })) });

export function NewCrewSettings({ groupId }: { groupId: string }) {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
  const scrollRef = useOpenAtTop<HTMLDivElement>();
  useStatusBarScrollToTop();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(crewManagementOptions(groupId));
  const [name, setName] = useState(data.name);
  const [about, setAbout] = useState(data.about ?? "");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useServerFn(saveCrewSettings);
  const manage = useServerFn(manageCrewMember);
  useEffect(() => { setName(data.name); setAbout(data.about ?? ""); }, [data.name, data.about]);
  const member = data.members.find((m) => m.id === memberId);
  const isOwner = data.owner_id === data.viewerId;
  const changed = name.trim() !== data.name || about.trim() !== (data.about ?? "");
  const refresh = () => queryClient.invalidateQueries();
  const memberAction = async (action: "transfer" | "remove") => {
    if (!member) return;
    setBusy(true); setError(null);
    try { await manage({ data: { groupId, memberId: member.id, action } }); setMemberId(null); setRemove(false); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't update this member. Try again."); }
    finally { setBusy(false); }
  };
  return <div className="redesign-step3 fixed inset-0 bg-[var(--new-bg)] text-[var(--new-ink)]">
    <div ref={scrollRef} data-scroll-root className="h-full overflow-y-auto pb-[calc(100px+env(safe-area-inset-bottom))]">
      <header className="grid grid-cols-[44px_1fr_44px] items-center bg-[var(--new-white)] px-4 pb-4 pt-new-top">
        <Button variant="ghost" size="icon" aria-label="Back" className="h-11 w-11 rounded-full bg-[var(--new-control)]" onClick={() => navigate({ to: "/crews/$groupId", params: { groupId } })}><ChevronLeft className="!size-[22px]" /></Button>
        <h1 className="text-center text-[17px] font-bold">Crew settings</h1>
      </header>
      {!isOwner ? <p role="alert" className="m-4 text-[16px]">Only the person who runs this crew can edit its settings.</p> : <>
        <section className="mx-4 my-3 rounded-[20px] bg-[var(--new-white)] p-4">
          <label htmlFor="crew-name" className="block text-[12px] font-extrabold tracking-[.6px] text-[var(--new-muted)]">NAME</label>
          <input id="crew-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-2 h-14 w-full rounded-[14px] border border-[var(--new-handle)] bg-[var(--new-white)] px-3 text-[17px] outline-none focus:border-[var(--new-purple)]" />
          <label htmlFor="crew-about" className="mt-4 block text-[12px] font-extrabold tracking-[.6px] text-[var(--new-muted)]">WHAT IT'S ABOUT</label>
          <textarea id="crew-about" placeholder="What's this crew about?" value={about} maxLength={120} onChange={(e) => setAbout(e.target.value)} rows={3} className="mt-2 min-h-14 w-full resize-none rounded-[14px] border border-[var(--new-handle)] bg-[var(--new-white)] px-3 py-3 text-[17px] outline-none placeholder:text-[var(--new-chevron)] focus:border-[var(--new-purple)]" />
        </section>
        <h2 className="px-4 pb-2 pt-2 text-[12px] font-extrabold tracking-[.6px] text-[var(--new-muted)]">MEMBERS · {data.members.length} OF {data.memberLimit}</h2>
        <section className="mx-4 overflow-hidden rounded-[20px] bg-[var(--new-white)] px-4">
          {data.members.map((m) => <div key={m.id} className="flex items-center gap-3 border-b border-[var(--new-divider)] py-3 last:border-b-0">
            <CrewAvatar member={m} size={44} />
            <div className="min-w-0 flex-1"><p className="text-[16px] font-bold">{m.name}</p><p className="mt-0.5 text-[13px] text-[var(--new-muted)]">{m.id === data.owner_id ? `Runs ${data.name}` : `Joined ${joinedCrewDate(m.joinedAt)}`}</p></div>
            {m.id !== data.viewerId && <Button variant="ghost" size="icon" aria-label={`Options for ${m.name}`} className="h-9 w-9 rounded-full" onClick={() => { setMemberId(m.id); setRemove(false); setError(null); }}><MoreHorizontal className="!size-[22px]" /></Button>}
          </div>)}
        </section>
        <p className="mx-4 mt-3 text-[13px] text-[var(--new-muted)]">Tap ••• next to someone to make them run the crew or remove them.</p>
        {error && !memberId && <p role="alert" className="mx-4 mt-3 text-[13px] text-[var(--new-destructive)]">{error}</p>}
      </>}
    </div>
    {isOwner && <footer className="absolute inset-x-0 bottom-0 bg-[var(--new-bg)] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <Button variant="ghost" disabled={!changed || busy || !name.trim()} className="h-[52px] w-full rounded-[26px] bg-[var(--new-purple)] text-[17px] font-bold text-[var(--new-white)] disabled:opacity-50 hover:bg-[var(--new-purple)] hover:text-[var(--new-white)]" onClick={async () => {
        setBusy(true); setError(null);
        try { await save({ data: { groupId, name: name.trim(), about: about.trim() || null } }); await refresh(); }
        catch (e) { setError(e instanceof Error ? e.message : "Couldn't save. Try again."); }
        finally { setBusy(false); }
      }}>Save</Button>
    </footer>}
    <NewSheet open={!!member && !remove} onOpenChange={(o) => { if (!o && !busy) setMemberId(null); }} title={member?.name ?? "Member"} subtitle={`In ${data.name} since ${member ? joinedCrewDate(member.joinedAt) : ""}`}>
      <div>
        <NewSheetRow simple title="View profile" leading={<User size={22} />} trailing={<NewSheetChevron />} onClick={() => { if (member) navigate({ to: "/u/$userId", params: { userId: member.id } }); }} />
        <NewSheetRow simple disabled={busy} title={`Make ${member?.name.split(" ")[0] ?? "them"} run the crew`} leading={<Crown size={22} />} trailing={<NewSheetChevron />} onClick={() => void memberAction("transfer")} />
        <NewSheetRow simple destructive title={`Remove from ${data.name}`} leading={<UserMinus size={22} className="text-[var(--new-destructive)]" />} onClick={() => setRemove(true)} />
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-[var(--new-destructive)]">{error}</p>}
    </NewSheet>
    <NewConfirm open={!!member && remove} onOpenChange={(o) => { if (!o) setRemove(false); }} title={`Remove ${member?.name.split(" ")[0] ?? "member"} from ${data.name}?`} subtitle="They won't see the crew's check-ins, posts or chat anymore. Their own streak and workouts stay with them. We won't tell them who removed them." action="Remove" busy={busy} error={error} onConfirm={() => void memberAction("remove")} />
  </div>;
}