import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "@/lib/follows.functions";
import { getHomeFollowState } from "@/lib/home-feed.functions";
import { newToast } from "./new-toast";
export function FollowPill({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getHomeFollowState);
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);
  const key = ["home-follow", userId];
  const state = useQuery({
    queryKey: key,
    queryFn: () => get({ data: { target: userId } }),
    staleTime: 30_000,
  });
  const [busy, setBusy] = useState(false);
  const relationship = state.data?.relationship ?? "none";
  const on = relationship === "following" || relationship === "requested";
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        await unfollow({ data: { target: userId } });
        qc.setQueryData(key, { canFollow: true, relationship: "none" });
      } else {
        const result = await follow({ data: { target: userId } });
        const relationship =
          typeof result === "string"
            ? result === "accepted"
              ? "following"
              : result === "requested"
                ? "requested"
                : "following"
            : (result as { status?: string })?.status === "requested"
              ? "requested"
              : "following";
        qc.setQueryData(key, { canFollow: true, relationship });
      }
      void qc.invalidateQueries({ queryKey: ["new-member-profile", userId] });
      void qc.invalidateQueries({ queryKey: ["home-social-posts", "following"] });
      void qc.invalidateQueries({ queryKey: ["social-list"] });
    } catch {
      newToast("Couldn't update follow. Try again.");
    } finally {
      setBusy(false);
    }
  };
  if (state.data?.canFollow === false) return null;
  return (
    <Button
      variant="ghost"
      className="new-home-follow"
      disabled={busy || state.isPending || state.isError}
      onClick={() => void run()}
      aria-label={`${on ? (relationship === "requested" ? "Cancel request for" : "Unfollow") : "Follow"} member`}
      aria-pressed={on}
    >
      {relationship === "requested"
        ? "Requested"
        : relationship === "following"
          ? "Following"
          : "Follow"}
    </Button>
  );
}
