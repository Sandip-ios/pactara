import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { useVersionToast } from "@/components/redesign/new-toast";
import { getCheckInShareData, type CheckInShareData } from "@/lib/daily-posts.functions";
import { usePartnerState } from "@/hooks/use-partner-state";
import { relationForGroup } from "@/lib/group-display";
import type { ShareCardInput } from "@/lib/share-card";
import { ShareWinScreen, type ShareMedia } from "./ShareWinScreen";

/** Builds the card input for one of the member's own posts (its own date's numbers). */
export function useShareInput(data: CheckInShareData | null): ShareCardInput | null {
  const { data: partnerState } = usePartnerState();
  return useMemo(() => {
    if (!data) return null;
    const relation = relationForGroup(data.groupId, partnerState);
    return {
      streak: data.streak,
      crewName: data.crewName,
      relation: relation?.kind === "partner" ? "partner" : relation?.kind === "solo" ? "solo" : "crew",
      activityLabel: data.activityLabel,
      week: data.week,
      workout: data.workout,
    };
  }, [data, partnerState]);
}

/**
 * Share your win for a check-in already in the feed (feed post menu, Home
 * Today card). Opens at once; the post's numbers and full-size media load
 * behind a spinner. Only the member's own check-ins (the server refuses others).
 */
export function ShareCheckInScreen({ checkInId, onClose }: { checkInId: string; onClose: () => void }) {
  const toast = useVersionToast();
  const fetchShare = useServerFn(getCheckInShareData);
  const [data, setData] = useState<CheckInShareData | null>(null);
  const [media, setMedia] = useState<ShareMedia | null>(null);
  const input = useShareInput(data);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    (async () => {
      const d = await fetchShare({ data: { checkInId } });
      if (!alive) return;
      if (!d.media) throw new Error("no media");
      setData(d);
      const res = await fetch(d.media.url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`media ${res.status}`);
      const blob = await res.blob();
      if (alive) setMedia({ blob, kind: d.media.kind });
    })().catch((e) => {
      if (!alive || (e as DOMException)?.name === "AbortError") return;
      console.error("[share] couldn't load check-in", e);
      toast.error("Couldn't open your check-in. Try again.");
      onClose();
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInId]);

  if (typeof document === "undefined") return null;
  return createPortal(<ShareWinScreen media={media} input={input} onClose={onClose} />, document.body);
}
