import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toggleSocialPostSave } from "@/lib/posts.functions";
import { getMySavedCheckInIds, toggleCheckInSave } from "@/lib/saved.functions";
import { dismissToastNow, newToast } from "./new-toast";

export const SAVED_TOAST_ID = "feed-saved";

export const SAVED_CHECKIN_IDS_KEY = ["saved-checkin-ids"] as const;

/** Bookmark on a feed card: optimistic, "Saved · View" toast on save, revert + error toast on failure. */
export function useFeedSave(kind: "post" | "checkin", id: string, initial?: boolean) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const postFn = useServerFn(toggleSocialPostSave);
  const ciFn = useServerFn(toggleCheckInSave);
  const ids = useQuery({ queryKey: SAVED_CHECKIN_IDS_KEY, queryFn: () => getMySavedCheckInIds(), staleTime: 60_000, enabled: kind === "checkin" });
  const [override, setOverride] = useState<boolean | null>(null);
  const saved = override ?? (kind === "checkin" ? (ids.data ?? []).includes(id) : !!initial);
  const toggle = async () => {
    const next = !saved;
    setOverride(next);
    try {
      await (kind === "checkin" ? ciFn({ data: { id, on: next } }) : postFn({ data: { id, on: next } }));
      if (kind === "checkin") qc.setQueryData<string[]>(SAVED_CHECKIN_IDS_KEY, (old = []) => (next ? [id, ...old.filter((x) => x !== id)] : old.filter((x) => x !== id)));
      void qc.invalidateQueries({ queryKey: ["saved-posts"] });
      if (kind === "post") void qc.invalidateQueries({ queryKey: ["social-post", id] });
      if (next) newToast("Saved", { id: SAVED_TOAST_ID, success: true, action: { label: "View", onClick: () => { dismissToastNow(SAVED_TOAST_ID); void navigate({ to: "/saved" }); } } });
    } catch {
      setOverride(!next);
      newToast("Couldn't save. Try again.");
    }
  };
  return { saved, toggle };
}
