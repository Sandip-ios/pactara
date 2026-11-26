import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Check, ChevronDown, CircleSlash, Copy, Mail, MessageCircle, MoreHorizontal, Plus, Search, Settings, Share2, Target, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroupToday } from "@/lib/group-today.functions";
import { crewPageCounts } from "@/lib/group-today-view";
import { getUnreadChatCounts } from "@/lib/chat.functions";
import { leaveGroup } from "@/lib/groups.functions";
import { getCrewManagement, leaveOwnedCrew } from "@/lib/crew-management.functions";
import { inviteLinkFor, CREW_INVITE_TEXT } from "@/components/groups/GroupOverflowMenu";
import { getMemberGoal, setMemberGoal, GOAL_MAX } from "@/lib/member-goal.functions";
import { NewSheet, NewSheetAvatars, NewSheetButton, NewSheetChevron, NewSheetRow } from "./NewSheet";
import { NewConfirm } from "./NewConfirm";
import { getCrewJoinOverview } from "@/lib/crew-join.functions";
import { discoveryAvatars } from "./NewCrewDiscovery";

export function NewCrewControls({ group, groups, tab, name, header = false }: {
  group: GroupToday; groups: GroupToday[]; tab: "today" | "posts" | "chat"; name: string; header?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<"switch" | "menu" | "invite" | "goal" | "leave" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [goal, setGoal] = useState("");
  const leave = useServerFn(leaveGroup);
  const leaveOwner = useServerFn(leaveOwnedCrew);
  const saveGoal = useServerFn(setMemberGoal);
  const fetchGoal = useServerFn(getMemberGoal);
  const { data: unread } = useQuery({ queryKey: ["unread-chat-counts"], queryFn: () => getUnreadChatCounts(), staleTime: 15_000 });
  const { data: joinOverview } = useQuery({ queryKey: ["crew-join-overview"], queryFn: () => getCrewJoinOverview(), staleTime: 15_000 });
  const pending = joinOverview?.pending ?? [];
  const requestCount = joinOverview?.counts[group.id] ?? 0;
  const { data: management } = useQuery({ queryKey: ["crew-management", group.id], queryFn: () => getCrewManagement({ data: { groupId: group.id } }), enabled: sheet === "leave" });
  const hasOtherUnread = groups.some((g) => g.id !== group.id && (unread?.counts[g.id] ?? 0) > 0);
  const next = management?.members.find((member) => member.id !== management.viewerId);
  const link = inviteLinkFor(group.id);
  const open = (value: typeof sheet) => { setError(null); setSheet(value); };
  const refresh = () => queryClient.invalidateQueries();
  const go = (action: () => void) => { setSheet(null); action(); };
  const invite = async () => {
    if (navigator.share && window.self === window.top) {
      try { await navigator.share({ title: CREW_INVITE_TEXT, text: CREW_INVITE_TEXT, url: link }); setSheet(null); return; } catch { /* use the same invite fallback */ }
    }
    open("invite");
  };
  const editGoal = async () => {
    open("goal"); setBusy(true); setGoal("");
    try { const result = await fetchGoal({ data: { groupId: group.id } }); setGoal(result.goal ?? ""); }
    catch { setError("Couldn't load your goal. Try again."); }
    finally { setBusy(false); }
  };
  return <>
    {header ? <Button variant="ghost" onClick={() => open("switch")} aria-label="Switch crew" className="h-auto max-w-full justify-start gap-2 p-0 text-[var(--new-ink)] hover:bg-transparent">
      <h1 className="truncate text-[22px] font-extrabold leading-[24px]">{name}</h1>
      <ChevronDown size={18} className="!size-[18px] shrink-0 text-[var(--new-muted)]" />
      {hasOtherUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--new-purple)]" aria-label="Unread activity in another crew" />}
    </Button> : <Button variant="ghost" size="icon" aria-label="Crew options" onClick={() => open("menu")} className="h-11 w-11 rounded-full bg-[var(--new-control)] text-[var(--new-ink)] hover:bg-[var(--new-control)]"><MoreHorizontal size={22} className="!size-[22px]" /></Button>}

    <NewSheet open={sheet === "switch"} onOpenChange={(o) => { if (!o) setSheet(null); }} title="Your crews">
      <div>{[...groups.filter((crew) => crew.id === group.id), ...groups.filter((crew) => crew.id !== group.id)].map((crew) => {
        const counts = crewPageCounts(crew.members), current = crew.id === group.id, count = unread?.counts[crew.id] ?? 0;
        return <NewSheetRow key={crew.id} title={crew.name} subtitle={`${counts.done} of ${counts.due} in · ${crew.groupStreak ? `${crew.groupStreak}-day streak` : "Crew streak starts today"}`}
          leading={<NewSheetAvatars members={crew.members.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl, avatarColor: m.avatarColor }))} />}
                    className={current ? "rounded-[16px] border-0 bg-[var(--new-lavender)] px-3 py-[10px] hover:bg-[var(--new-lavender)]" : "border-b-0"}
          trailing={current ? <Check size={22} className="!size-[22px] text-[var(--new-purple)]" /> : count > 0 ? <span className="flex h-6 shrink-0 items-center rounded-full bg-[var(--new-purple)] px-2 text-[13px] font-bold text-[var(--new-white)]">{count} new</span> : undefined}
          onClick={() => go(() => navigate({ to: "/crews/$groupId", params: { groupId: crew.id }, search: tab === "today" ? {} : { crewTab: tab } }))} />;
      })}</div>
      {pending.length > 0 && <div>
        {pending.map((crew) => <NewSheetRow key={crew.id} className="border-b-0" title={crew.name} subtitle={`Requested · waiting on ${crew.ownerFirstName}`} leading={<NewSheetAvatars members={discoveryAvatars(crew)} />} trailing={<span className="shrink-0 text-[13px] font-bold text-[var(--new-muted)]">Pending</span>} onClick={() => go(() => navigate({ to: "/crews/$groupId/preview", params: { groupId: crew.id } }))} />)}
      </div>}
      <div className="mt-4 grid grid-cols-2 gap-[10px]">
        <NewSheetButton secondary className="mt-0 h-12 rounded-[24px] text-[15px]" onClick={() => go(() => navigate({ to: "/crews" }))}><Search size={18} />Find a crew</NewSheetButton>
        <NewSheetButton secondary className="mt-0 h-12 rounded-[24px] text-[15px]" onClick={() => go(() => navigate({ to: "/new-pactara" }))}><Plus size={18} />New crew</NewSheetButton>
      </div>
    </NewSheet>
    <NewSheet open={sheet === "menu"} onOpenChange={(o) => { if (!o) setSheet(null); }} title={name} subtitle="Private. Only members see inside.">
      <div>
        {group.isAdmin && <NewSheetRow simple title="Crew settings" leading={<Settings size={22} />} trailing={<NewSheetChevron />} onClick={() => go(() => navigate({ to: "/crews/$groupId/settings", params: { groupId: group.id } }))} />}
        <NewSheetRow simple title="Invite people" leading={<UserPlus size={22} />} trailing={<NewSheetChevron />} onClick={() => void invite()} />
        {group.isAdmin && <NewSheetRow simple title="Join requests" leading={<Users size={22} />} trailing={<span className="flex shrink-0 items-center gap-2">{requestCount > 0 && <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[var(--new-purple)] px-1.5 text-[13px] font-bold text-[var(--new-white)]">{requestCount}</span>}<NewSheetChevron /></span>} onClick={() => go(() => navigate({ to: "/crews/$groupId/requests", params: { groupId: group.id } }))} />}
        <NewSheetRow simple title="Your goal in this crew" leading={<Target size={22} />} trailing={<NewSheetChevron />} onClick={() => void editGoal()} />
        <NewSheetRow simple title="Schedule and pact" leading={<CalendarDays size={22} />} trailing={<span className="flex shrink-0 items-center gap-2"><span className="text-[14px] font-normal text-[var(--new-muted)]">Day {group.dayNumber} of {group.durationDays}</span><NewSheetChevron /></span>} onClick={() => go(() => navigate({ to: "/pact/$groupId", params: { groupId: group.id } }))} />
        <NewSheetRow simple destructive title="Leave crew" leading={<CircleSlash size={22} className="text-[var(--new-destructive)]" />} onClick={() => open("leave")} />
      </div>
    </NewSheet>
    <NewSheet open={sheet === "invite"} onOpenChange={(o) => { if (!o) setSheet(null); }} title={`Invite people to ${name}`} subtitle={CREW_INVITE_TEXT}>
      <div>
        <NewSheetRow simple title={copied ? "Copied!" : "Copy invite link"} leading={<Copy size={22} />} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("Couldn't copy. Use the link below."); } }} />
        {typeof navigator !== "undefined" && !!navigator.share && window.self === window.top && <NewSheetRow simple title="Share invite" leading={<Share2 size={22} />} onClick={() => void invite()} />}
        <NewSheetRow simple title="Messages" leading={<MessageCircle size={22} />} onClick={() => { window.location.href = `sms:?body=${encodeURIComponent(`${CREW_INVITE_TEXT} ${link}`)}`; }} />
        <NewSheetRow simple title="Email" leading={<Mail size={22} />} onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(CREW_INVITE_TEXT)}&body=${encodeURIComponent(`${CREW_INVITE_TEXT} ${link}`)}`; }} />
      </div>
      <input readOnly aria-label="Invite link" value={link} className="mt-3 w-full rounded-[14px] border border-[var(--new-handle)] p-3 text-[13px]" />
      {error && <p role="alert" className="mt-2 text-[13px] text-[var(--new-destructive)]">{error}</p>}
    </NewSheet>
    <NewSheet open={sheet === "goal"} onOpenChange={(o) => { if (!o && !busy) setSheet(null); }} title="Your goal in this crew" subtitle={`Everyone in ${name} sets their own.`}>
      <textarea aria-label="Your goal" maxLength={GOAL_MAX} value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="w-full rounded-[14px] border border-[var(--new-handle)] p-3 text-[17px]" />
      {error && <p role="alert" className="text-[13px] text-[var(--new-destructive)]">{error}</p>}
      <NewSheetButton disabled={busy || !goal.trim()} onClick={async () => { setBusy(true); try { await saveGoal({ data: { groupId: group.id, goal: goal.trim() } }); await refresh(); setSheet(null); } catch { setError("Couldn't save your goal. Try again."); } finally { setBusy(false); } }}>Save</NewSheetButton>
    </NewSheet>
    <NewConfirm open={sheet === "leave"} onOpenChange={(o) => { if (!o) setSheet(null); }} title={`Leave ${name}?`}
      subtitle={`You'll lose access to the crew's check-ins, posts and chat. Your own streak stays.${group.isAdmin && next ? ` You run ${name}, so ${next.name} will take over.` : ""}`}
      action="Leave crew" busy={busy || (group.isAdmin && !management) || (group.isAdmin && !next)} error={group.isAdmin && management && !next ? "Invite someone before leaving this crew." : error}
      onConfirm={async () => { setBusy(true); try { if (group.isAdmin) await leaveOwner({ data: { groupId: group.id } }); else await leave({ data: { groupId: group.id } }); await refresh(); go(() => navigate({ to: "/crews" })); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't leave. Try again."); } finally { setBusy(false); } }} />
  </>;
}