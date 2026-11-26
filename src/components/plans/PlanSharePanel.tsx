import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { NewSheet, NewSheetButton } from "@/components/redesign/NewSheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { CrewRow, SectionLabel, ShareLinkRow } from "@/components/workout/WorkoutSharePanel";
import { showTopError, showTopMessage } from "@/components/workout/savedToast";
import { FONT, W } from "@/components/workout/WorkoutBits";
import { getPlanSharePanel, sendPlanToCrew } from "@/lib/plan-share.functions";
import { planCoverAt, planMetaLine, planShareText, planShareTitle } from "@/lib/plan-share";
import { shareLink } from "@/lib/share-link";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";

const panelKey = (slug: string) => ["plan-share-panel", slug] as const;

type PanelPlan = { slug: string; name: string; weeks: number; daysPerWeek: number; minutes: string; coverUrl: string | null };

/**
 * Share “Build Muscle”: send it into a crew's chat as a plan card, or share
 * a link anywhere else. Same panel as workouts; works on or off the plan.
 */
export function PlanSharePanel({ open, plan, onClose, variant = "classic" }: { open: boolean; plan: PanelPlan; onClose: () => void; variant?: "classic" | "new" }) {
  const qc = useQueryClient();
  const panelFn = useServerFn(getPlanSharePanel);
  const sendFn = useServerFn(sendPlanToCrew);
  const { data: partnerState } = usePartnerState();
  const { data, isLoading } = useQuery({
    queryKey: panelKey(plan.slug),
    queryFn: () => panelFn({ data: { slug: plan.slug } }),
    enabled: open,
    staleTime: 0,
  });
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [linkBusy, setLinkBusy] = useState(false);
  const sent = new Set(data?.sentGroupIds ?? []);
  const crews = data?.crews ?? [];
  const thumb = planCoverAt(plan.coverUrl, 168, 168);

  const send = async (groupId: string) => {
    if (sending.has(groupId) || sent.has(groupId)) return;
    setSending((s) => new Set(s).add(groupId));
    try {
      await sendFn({ data: { slug: plan.slug, groupId } });
      qc.setQueryData<typeof data>(panelKey(plan.slug), (old) =>
        old ? { ...old, sentGroupIds: [...new Set([...old.sentGroupIds, groupId])] } : old,
      );
      void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
    } catch (e) {
      console.error("[plan-share] send to crew failed", e);
      showTopError("Couldn't send. Try again.");
    } finally {
      setSending((s) => {
        const n = new Set(s);
        n.delete(groupId);
        return n;
      });
    }
  };

  const shareByLink = async () => {
    if (linkBusy || !data?.url) return;
    setLinkBusy(true);
    try {
      const outcome = await shareLink({ title: planShareTitle(plan.name), text: planShareText(plan.name), url: data.url });
      // The panel covers the bottom of the screen: these show at the top.
      if (outcome === "copied") showTopMessage("Link copied");
      else if (outcome === "failed") showTopMessage("Couldn't share. Try again.");
    } finally {
      setLinkBusy(false);
    }
  };

  const body = (
    <>
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

          {!isLoading && data && (
            <section className="flex flex-col gap-2">
              <SectionLabel>ANYONE ELSE</SectionLabel>
              <ShareLinkRow onClick={() => void shareByLink()} busy={linkBusy} />
            </section>
          )}

    </>
  );

  if (variant === "new") {
    return (
      <NewSheet open={open} onOpenChange={(o) => !o && onClose()} title={`Share “${plan.name}”`} subtitle={planMetaLine(plan)}>
        <div className="flex flex-col gap-4" style={{ fontFamily: FONT, color: W.ink }}>{body}</div>
        <NewSheetButton secondary onClick={onClose}>Done</NewSheetButton>
      </NewSheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent
        className="max-h-[88dvh] rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]"
        style={{ fontFamily: FONT, color: W.ink }}
      >
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-4">
          <div className="flex items-center gap-3">
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px]" style={{ background: "#2E1065" }} aria-hidden>
              {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <DrawerTitle className="text-[20px] font-extrabold leading-tight">Share “{plan.name}”</DrawerTitle>
              <DrawerDescription className="text-[13px]" style={{ color: W.muted }}>
                {planMetaLine(plan)}
              </DrawerDescription>
            </span>
          </div>

          {body}
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
