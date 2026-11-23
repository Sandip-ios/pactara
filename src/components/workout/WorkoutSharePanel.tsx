import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Loader2, Share } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { getWorkoutSharePanel, sendWorkoutToCrew, type ShareCrew } from "@/lib/workout-share.functions";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";
import { plural } from "@/lib/lift-rules";
import { showTopError } from "./savedToast";
import { FONT, W } from "./WorkoutBits";

const panelKey = (workoutId: string | null) => ["workout-share-panel", workoutId] as const;

/**
 * Share “Push day”: send it into a crew's chat as a workout card, or share a
 * link anywhere else. Always the workout as it's saved (exercises and sets).
 */
export function WorkoutSharePanel({
  open,
  workoutId,
  name,
  onClose,
  onShareLink,
  linkBusy,
}: {
  open: boolean;
  workoutId: string | null;
  name: string;
  onClose: () => void;
  onShareLink: () => void;
  linkBusy: boolean;
}) {
  const qc = useQueryClient();
  const panelFn = useServerFn(getWorkoutSharePanel);
  const sendFn = useServerFn(sendWorkoutToCrew);
  const { data: partnerState } = usePartnerState();
  const { data, isLoading } = useQuery({
    queryKey: panelKey(workoutId),
    queryFn: () => panelFn({ data: { workoutId: workoutId! } }),
    enabled: open && !!workoutId,
    staleTime: 0,
  });
  const [sending, setSending] = useState<Set<string>>(new Set());
  const sent = new Set(data?.sentGroupIds ?? []);
  const crews = data?.crews ?? [];

  const send = async (groupId: string) => {
    if (!workoutId || sending.has(groupId) || sent.has(groupId)) return;
    setSending((s) => new Set(s).add(groupId));
    try {
      await sendFn({ data: { workoutId, groupId } });
      qc.setQueryData<typeof data>(panelKey(workoutId), (old) =>
        old ? { ...old, sentGroupIds: [...new Set([...old.sentGroupIds, groupId])] } : old,
      );
      void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
    } catch (e) {
      console.error("[share] send to crew failed", e);
      showTopError("Couldn't send. Try again.");
    } finally {
      setSending((s) => {
        const n = new Set(s);
        n.delete(groupId);
        return n;
      });
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent
        className="max-h-[88dvh] rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]"
        style={{ fontFamily: FONT, color: W.ink }}
      >
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-4">
          <div className="flex flex-col gap-1">
            <DrawerTitle className="text-[20px] font-extrabold leading-tight">Share “{name}”</DrawerTitle>
            <DrawerDescription className="text-[13px]" style={{ color: W.muted }}>
              Exercises and sets only. Your weights stay private.
            </DrawerDescription>
          </div>

          {isLoading && (
            <div className="flex h-[60px] items-center justify-center" aria-label="Loading crews">
              <Loader2 size={20} className="animate-spin" style={{ color: W.muted }} />
            </div>
          )}

          {crews.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionLabel>SEND TO A CREW</SectionLabel>
              <ul className="overflow-hidden rounded-[16px]" style={{ border: `1.5px solid ${W.divider}` }}>
                {crews.map((c, i) => (
                  <CrewRow
                    key={c.id}
                    crew={c}
                    first={i === 0}
                    display={relationForGroup(c.id, partnerState)}
                    state={sending.has(c.id) ? "sending" : sent.has(c.id) ? "sent" : "idle"}
                    onSend={() => void send(c.id)}
                    onOpenChat={onClose}
                  />
                ))}
              </ul>
            </section>
          )}

          {!isLoading && (
            <section className="flex flex-col gap-2">
              <SectionLabel>ANYONE ELSE</SectionLabel>
              <button
                type="button"
                onClick={onShareLink}
                disabled={linkBusy}
                className="flex min-h-[60px] w-full items-center gap-3 rounded-[16px] px-3 text-left disabled:opacity-60"
                style={{ border: `1.5px solid ${W.divider}` }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: W.chip }} aria-hidden>
                  {linkBusy ? <Loader2 size={17} className="animate-spin" /> : <Share size={17} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-bold">Share a link</span>
                  <span className="text-[13px]" style={{ color: W.muted }}>
                    Messages, WhatsApp, copy link…
                  </span>
                </span>
                <ChevronRight size={18} style={{ color: W.disabled }} aria-hidden />
              </button>
            </section>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mb-1 h-[52px] rounded-[26px] bg-white text-[16px] font-bold"
            style={{ border: `1.5px solid ${W.line}`, color: W.ink }}
          >
            Done
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>
      {children}
    </h3>
  );
}

function CrewRow({
  crew,
  first,
  display,
  state,
  onSend,
  onOpenChat,
}: {
  crew: ShareCrew;
  first: boolean;
  display: { emoji: string; name: string } | null;
  state: "idle" | "sending" | "sent";
  onSend: () => void;
  onOpenChat: () => void;
}) {
  const name = display?.name ?? crew.name;
  const emoji = display?.emoji ?? crew.emoji;
  return (
    <li className="flex min-h-[60px] items-center gap-3 px-3 py-2" style={{ borderTop: first ? undefined : `1px solid ${W.divider}` }}>
      {/* Fixed slot: 3 overlapping 32px avatars (32 + 22 + 22) so every crew
          name starts at the same x whether the crew shows 1 photo or 3. */}
      <span className="flex w-[76px] shrink-0 justify-start" aria-hidden>
        <span className="flex -space-x-2.5">
          {crew.others.map((m) => (
            <span
              key={m.id}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[12px] font-bold text-white ring-2 ring-white"
              style={{ background: m.avatarColor }}
            >
              {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : (m.name[0] ?? "?").toUpperCase()}
            </span>
          ))}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">
          {emoji} {name}
        </span>
        {state === "sent" ? (
          <span className="text-[13px]" style={{ color: W.muted }}>
            Sent ·{" "}
            <Link to="/chat/$groupId" params={{ groupId: crew.id }} onClick={onOpenChat} className="font-bold" style={{ color: W.violet }}>
              Open chat
            </Link>
          </span>
        ) : (
          <span className="text-[13px]" style={{ color: W.muted }}>
            {plural(crew.memberCount, "member")}
          </span>
        )}
      </span>
      {state === "sent" ? (
        <span
          className="flex h-9 shrink-0 items-center gap-1 rounded-[18px] px-3.5 text-[14px] font-bold"
          style={{ background: W.lilacSoft, color: W.violetText }}
          aria-label={`Sent to ${name}`}
        >
          <Check size={15} strokeWidth={3} aria-hidden /> Sent
        </span>
      ) : (
        <button
          type="button"
          onClick={onSend}
          disabled={state === "sending"}
          aria-label={`Send to ${name}`}
          className="relative flex h-9 min-w-[68px] shrink-0 items-center justify-center rounded-[18px] px-4 text-[14px] font-bold text-white after:absolute after:-inset-1 after:content-['']"
          style={{ background: W.purple }}
        >
          {state === "sending" ? <Loader2 size={16} className="animate-spin" aria-label="Sending" /> : "Send"}
        </button>
      )}
    </li>
  );
}
