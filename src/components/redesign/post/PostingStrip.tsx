import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onPostLive, resumePendingPosts, retryPost, usePostingStrip } from "@/lib/posting-queue";
import { INK, MUTED, PURPLE } from "./PostBits";

/** "Posting..." under the Home tabs; resumes on launch and when the app comes back. */
export function PostingStrip() {
  const strip = usePostingStrip();
  const qc = useQueryClient();
  useEffect(() => {
    void resumePendingPosts();
    const onVis = () => { if (document.visibilityState === "visible") void resumePendingPosts(); };
    document.addEventListener("visibilitychange", onVis);
    const off = onPostLive(() => {
      void qc.invalidateQueries({ queryKey: ["my-social-posts"] });
      void qc.invalidateQueries({ queryKey: ["crew-social-posts"] });
    });
    return () => { document.removeEventListener("visibilitychange", onVis); off(); };
  }, [qc]);
  if (!strip) return null;
  return (
    <div className="mx-3 mt-2 flex items-center gap-3 rounded-[14px] bg-white px-3 py-2.5" role="status" style={{ color: INK }}>
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-neutral-200">{strip.thumbUrl && <img src={strip.thumbUrl} alt="" className="h-full w-full object-cover" />}</span>
      <div className="min-w-0 flex-1">
        {strip.failed ? (
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold">Couldn't post</span>
            <button type="button" onClick={() => void retryPost(strip.postId)} className="h-9 px-2 text-[14px] font-bold" style={{ color: PURPLE }}>Retry</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-bold">{strip.label}</span>
              <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{strip.progress}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "#EFEAE4" }}>
              <div className="h-full rounded-full transition-[width]" style={{ width: `${strip.progress}%`, background: PURPLE }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
