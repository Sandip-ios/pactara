import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onPostLive, resumePendingPosts, retryPost, usePostingStrip } from "@/lib/posting-queue";
import { INK, MUTED, PURPLE } from "./PostBits";
import { postVideoRatio } from "@/lib/post-video-layout";

/** "Posting..." under the Home tabs; resumes on launch and when the app comes back. */
export function PostingStrip() {
  const strip = usePostingStrip();
  const qc = useQueryClient();
  const [thumbRatio, setThumbRatio] = useState(9 / 16);
  useEffect(() => {
    void resumePendingPosts();
    const onVis = () => { if (document.visibilityState === "visible") void resumePendingPosts(); };
    document.addEventListener("visibilitychange", onVis);
    const off = onPostLive(() => {
      void qc.invalidateQueries({ queryKey: ["my-social-posts"] });
      void qc.invalidateQueries({ queryKey: ["crew-social-posts"] });
      void qc.invalidateQueries({ queryKey: ["home-social-posts"] });
    });
    return () => { document.removeEventListener("visibilitychange", onVis); off(); };
  }, [qc]);
  if (!strip) return null;
  return (
    <div className="flex w-full items-center gap-3 border-b border-[var(--new-header-border)] bg-[var(--new-white)] px-4 py-2.5" role="status" style={{ color: INK }}>
      <span className={`h-10 shrink-0 overflow-hidden rounded-[8px] ${strip.thumbKind === "video" ? "bg-[var(--new-library-video)]" : "w-10 bg-[var(--new-control)]"}`} style={strip.thumbKind === "video" ? { aspectRatio: thumbRatio } : undefined}>{strip.thumbUrl && <img src={strip.thumbUrl} alt="" onLoad={(e) => setThumbRatio(postVideoRatio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight))} className={`h-full w-full ${strip.thumbKind === "video" ? "object-contain" : "object-cover"}`} />}</span>
      <div className="min-w-0 flex-1">
        {strip.failed ? (
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Couldn't post</span>
            <button type="button" onClick={() => void retryPost(strip.postId)} className="h-9 px-2 text-[14px] font-bold" style={{ color: PURPLE }}>Retry</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">{strip.label}</span>
              <span className="text-[13px]" style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{strip.progress}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-[2px]" style={{ background: "#EFEAE4" }}>
              <div className="h-full rounded-[2px] transition-[width]" style={{ width: `${strip.progress}%`, background: PURPLE }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
