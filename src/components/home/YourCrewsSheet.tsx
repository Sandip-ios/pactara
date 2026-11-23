import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Link as LinkIcon, MoreHorizontal, Plus } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { CrewAvatarStack } from "@/components/groups/CrewAvatarStack";
import { useCrewOptions, type CrewOptionsCrew } from "@/components/groups/GroupOverflowMenu";
import { PendingInvitesRow } from "@/components/groups/PendingInvitesRow";
import { getGroupsToday, type GroupToday } from "@/lib/group-today.functions";
import { crewPageCounts } from "@/lib/group-today-view";
import { crewsStillToShowUp, inTodayLine, inviteIdFromInput } from "@/lib/your-crews";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";

const INK = "#141218";
const MUTED = "#78716C";
const PURPLE = "#7C3AED";
const DIVIDER = "#F0EDE9";

type Step = "list" | "options";

/**
 * Home's crew switcher: every crew with who's in today and the ways to start
 * or join another crew. A crew's ••• pushes its options in as a second step
 * of this same sheet, with a "Your crews" back row; swiping down or tapping
 * the backdrop closes the whole sheet. Confirm sheets open on top of it.
 */
export function YourCrewsSheet({
  open,
  onOpenChange,
  selectedGroupId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGroupId: string | null;
  onSelect: (groupId: string) => void;
}) {
  const navigate = useNavigate();
  const { data: partnerState } = usePartnerState();
  const { data, isLoading } = useQuery({
    queryKey: ["groups-today"],
    queryFn: () => getGroupsToday(),
    enabled: open,
    staleTime: 30_000,
  });
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinText, setJoinText] = useState("");
  const [step, setStep] = useState<Step>("list");
  const [optionsId, setOptionsId] = useState<string | null>(null);
  // The panel sliding out while the next one slides in.
  const [outgoing, setOutgoing] = useState<{ step: Step; dir: "push" | "back" } | null>(null);
  const outTimer = useRef<number | undefined>(undefined);

  // Every open starts on the list.
  useLayoutEffect(() => {
    if (!open) return;
    window.clearTimeout(outTimer.current);
    setStep("list");
    setOutgoing(null);
  }, [open]);

  const go = (next: Step, dir: "push" | "back") => {
    if (next === step) return;
    window.clearTimeout(outTimer.current);
    setOutgoing({ step, dir });
    setStep(next);
    outTimer.current = window.setTimeout(() => setOutgoing(null), 300);
  };

  const groups = data?.groups ?? [];
  const waiting = crewsStillToShowUp(groups);

  const toOptionsCrew = (g: GroupToday, name: string, emoji: string): CrewOptionsCrew => ({
    id: g.id,
    name,
    emoji,
    isAdmin: g.isAdmin,
    duration: g.durationDays,
    frequency: g.frequency,
    daysPerWeek: g.daysPerWeek,
    memberCount: g.memberCount,
    others: g.members
      .filter((m) => !m.isYou)
      .map((m) => ({ id: m.userId, name: m.firstName, avatarColor: m.avatarColor, avatarUrl: m.avatarUrl })),
  });

  // Read the crew live so a rename or rule change shows right away.
  const optionsGroup = optionsId ? groups.find((g) => g.id === optionsId) ?? null : null;
  const optionsCrew = optionsGroup
    ? (() => {
        const rel = relationForGroup(optionsGroup.id, partnerState);
        return toOptionsCrew(optionsGroup, rel?.name ?? optionsGroup.name, rel?.emoji ?? optionsGroup.emoji);
      })()
    : null;
  // Keep the last crew after it's left or deleted, so its confirm sheet can
  // finish closing and its options can slide out.
  const lastCrew = useRef<CrewOptionsCrew | null>(null);
  if (optionsCrew) lastCrew.current = optionsCrew;
  else if (optionsId && lastCrew.current?.id !== optionsId) lastCrew.current = null;
  const { body: optionsBody, dialogs } = useCrewOptions(optionsCrew ?? lastCrew.current, {
    // Left or deleted: that crew's options no longer exist, back to the list.
    onGone: () => go("list", "back"),
  });

  const join = () => {
    const id = inviteIdFromInput(joinText);
    if (!id) return;
    onOpenChange(false);
    void navigate({ to: "/join/$groupId", params: { groupId: id } });
  };

  const renderStep = (which: Step) =>
    which === "options" ? (
      <div className="flex max-h-[84dvh] flex-col gap-3 overflow-y-auto px-4 pt-1 pb-1">
        <button
          type="button"
          onClick={() => go("list", "back")}
          className="-ml-1 flex min-h-[44px] items-center gap-1 self-start pr-3 text-[15px] font-bold"
          style={{ color: "#6D28D9" }}
        >
          <ChevronLeft size={20} strokeWidth={2.5} aria-hidden />
          Your crews
        </button>
        {optionsBody}
      </div>
    ) : (
      <div className="flex max-h-[84dvh] flex-col gap-4 overflow-y-auto px-4 pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[20px] font-extrabold leading-tight">Your crews</h2>
              {waiting > 0 && (
                <span className="shrink-0 text-[13px] font-bold" style={{ color: "#C2410C" }}>
                  {waiting} still to show up today
                </span>
              )}
            </div>

            {isLoading && !data ? (
              <div className="overflow-hidden rounded-[16px]" style={{ border: `1.5px solid ${DIVIDER}` }} aria-label="Loading crews">
                {[0, 1].map((i) => (
                  <div key={i} className="flex min-h-[64px] items-center gap-3 px-3" style={{ borderTop: i ? `1px solid ${DIVIDER}` : undefined }}>
                    <span className="h-[34px] w-[60px] animate-pulse rounded-full bg-neutral-200" />
                    <span className="h-4 flex-1 animate-pulse rounded bg-neutral-200" />
                  </div>
                ))}
              </div>
            ) : groups.length > 0 ? (
              <ul className="overflow-hidden rounded-[16px]" style={{ border: `1.5px solid ${DIVIDER}` }}>
                {groups.map((g, i) => {
                  const rel = relationForGroup(g.id, partnerState);
                  const name = rel?.name ?? g.name;
                  const emoji = rel?.emoji ?? g.emoji;
                  const current = g.id === selectedGroupId;
                  const others = g.members
                    .filter((m) => !m.isYou)
                    .map((m) => ({ id: m.userId, name: m.firstName, avatarColor: m.avatarColor, avatarUrl: m.avatarUrl }));
                  return (
                    <li
                      key={g.id}
                      className="flex min-h-[64px] items-center"
                      style={{ borderTop: i ? `1px solid ${DIVIDER}` : undefined, background: current ? "#F7F4FE" : undefined }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(g.id);
                          onOpenChange(false);
                        }}
                        aria-current={current ? "true" : undefined}
                        className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left"
                      >
                        <CrewAvatarStack members={others} emoji={emoji} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[16px] font-bold">
                            {emoji} {name}
                          </span>
                          <span className="text-[13px]" style={{ color: MUTED }}>
                            {inTodayLine(crewPageCounts(g.members))}
                          </span>
                        </span>
                        {current && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: PURPLE }} aria-label="Current crew">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`${name} options`}
                        onClick={() => {
                          setOptionsId(g.id);
                          go("options", "push");
                        }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        style={{ color: "#57534E" }}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <div className="overflow-hidden rounded-[16px]" style={{ border: `1.5px solid ${DIVIDER}` }}>
              <ActionRow
                icon={<Plus size={18} />}
                title="Start a crew"
                subtitle="Pick a goal, invite friends"
                onClick={() => {
                  onOpenChange(false);
                  void navigate({ to: "/new-pactara" });
                }}
              />
              <div style={{ borderTop: `1px solid ${DIVIDER}` }}>
                <ActionRow
                  icon={<LinkIcon size={17} />}
                  title="Join with a link"
                  subtitle="Paste an invite link or code"
                  open={joinOpen}
                  onClick={() => setJoinOpen((v) => !v)}
                />
                {joinOpen && (
                  <div className="flex gap-2 px-3 pb-3">
                    <input
                      value={joinText}
                      onChange={(e) => setJoinText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && join()}
                      placeholder="Invite link or code"
                      aria-label="Invite link or code"
                      autoFocus
                      className="h-11 min-w-0 flex-1 rounded-[14px] border border-neutral-200 bg-white px-3 text-[16px] outline-none focus:border-purple-300"
                    />
                    <button
                      type="button"
                      onClick={join}
                      disabled={!inviteIdFromInput(joinText)}
                      className="h-11 rounded-[14px] px-5 text-[15px] font-bold text-white disabled:opacity-50"
                      style={{ background: PURPLE }}
                    >
                      Join
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="-mx-4 -mt-4 pb-1">
              <PendingInvitesRow joinedIds={groups.map((g) => g.id)} />
            </div>
                </div>
    );

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]"
          style={{ fontFamily: "Inter, system-ui, sans-serif", color: INK }}
        >
          <DrawerTitle className="sr-only">Your crews</DrawerTitle>
          <DrawerDescription className="sr-only">Switch crews, manage a crew, or start or join another one.</DrawerDescription>
          <div className="relative overflow-hidden">
            <div key={step} className={outgoing ? (outgoing.dir === "push" ? "crew-step-in-push" : "crew-step-in-back") : undefined}>
              {renderStep(step)}
            </div>
            {outgoing && (
              <div
                key={`out-${outgoing.step}`}
                aria-hidden
                className={`pointer-events-none absolute inset-x-0 top-0 ${outgoing.dir === "push" ? "crew-step-out-push" : "crew-step-out-back"}`}
              >
                {renderStep(outgoing.step)}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {dialogs}
    </>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
  open,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  open?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} className="flex min-h-[64px] w-full items-center gap-3 px-3 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "#EDE7FB", color: "#5B21B6" }} aria-hidden>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px]" style={{ color: MUTED }}>
          {subtitle}
        </span>
      </span>
      <ChevronRight size={18} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} style={{ color: "#A8A29E" }} aria-hidden />
    </button>
  );
}
