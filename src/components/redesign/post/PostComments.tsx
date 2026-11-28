import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addSocialPostComment, getSocialPostComments } from "@/lib/posts.functions";
import { NewSheet } from "../NewSheet";
import { INK, MUTED, PURPLE } from "./PostBits";

export function PostCommentsSheet({ postId, open, onOpenChange, canComment }: { postId: string; open: boolean; onOpenChange: (o: boolean) => void; canComment: boolean }) {
  const qc = useQueryClient();
  const key = ["social-post-comments", postId];
  const list = useQuery({ queryKey: key, queryFn: () => getSocialPostComments({ data: { id: postId } }), enabled: open && canComment });
  const addFn = useServerFn(addSocialPostComment);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await addFn({ data: { id: postId, body: text } }); setText(""); await qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ["social-post", postId] }); }
    finally { setBusy(false); }
  };
  return (
    <NewSheet open={open && canComment} onOpenChange={onOpenChange} title="Comments">
      <div style={{ color: INK }}>
        {list.isLoading ? <div className="h-16 animate-pulse rounded-[12px] bg-[var(--new-control)]" /> : (list.data ?? []).length === 0 ? (
          <p className="py-2 text-[14px]" style={{ color: MUTED }}>No comments yet.</p>
        ) : (
          <ul className="max-h-[40vh] overflow-y-auto">
            {(list.data ?? []).map((c) => <li key={c.id} className="py-2 text-[15px]"><strong>{c.name}</strong> {c.body}</li>)}
          </ul>
        )}
        {canComment && (
          <div className="mt-3 flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Add a comment" aria-label="Add a comment" className="h-11 min-w-0 flex-1 rounded-full bg-[var(--new-control)] px-4 text-[16px] outline-none" />
            <button type="button" disabled={!text.trim() || busy} onClick={() => void send()} className="h-11 px-2 text-[15px] font-bold disabled:opacity-50" style={{ color: PURPLE }}>Post</button>
          </div>
        )}
      </div>
    </NewSheet>
  );
}
