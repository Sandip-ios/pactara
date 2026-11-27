import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, ChevronLeft, Flame, MessageCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { deleteSocialPost, getSocialPost, toggleSocialPostSave, updateSocialPostCaption } from "@/lib/posts.functions";
import { clock } from "@/components/TimelineCard";
import { NewSheet, NewSheetMenuIcon, NewSheetRow, NewSheetButton } from "../NewSheet";
import { NewConfirm } from "../NewConfirm";
import { newToast } from "../new-toast";
import { CrewAvatar } from "../CrewAvatars";
import { PostCarousel, PostWorkoutCard, INK, MUTED, PostTopBar } from "./PostBits";
import { PostCommentsSheet } from "./PostComments";

/** One post: header "Posts", menu (Edit caption, Delete), carousel, caption, workout, counts. */
export function NewOwnPost({ postId }: { postId: string }) {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: post, isLoading } = useQuery({ queryKey: ["social-post", postId], queryFn: () => getSocialPost({ data: { id: postId } }) });
  const delFn = useServerFn(deleteSocialPost);
  const capFn = useServerFn(updateSocialPostCaption);
  const saveFn = useServerFn(toggleSocialPostSave);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [comments, setComments] = useState(false);
  const back = () => (router.history.canGoBack() ? router.history.back() : void navigate({ to: "/profile" }));

  if (isLoading) return <div className="fixed inset-0 bg-white" aria-busy="true" />;
  if (!post) return (
    <div className="fixed inset-0 bg-white">
      <PostTopBar title="Posts" left={<button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center"><ChevronLeft size={26} /></button>} />
      <p className="px-6 pt-10 text-center text-[15px]" style={{ color: MUTED }}>This post isn't available.</p>
    </div>
  );

  const remove = async () => {
    setBusy(true);
    setErr(null);
    try {
      await delFn({ data: { id: post.id } });
      void qc.invalidateQueries({ queryKey: ["my-social-posts"] });
      newToast("Post deleted", { success: true });
      back();
    } catch { setErr("Couldn't delete. Try again."); setBusy(false); }
  };
  const saveCaption = async () => {
    setBusy(true);
    try {
      await capFn({ data: { id: post.id, caption } });
      await qc.invalidateQueries({ queryKey: ["social-post", post.id] });
      setEditing(false);
    } catch { newToast("Couldn't save. Try again."); } finally { setBusy(false); }
  };
  const toggleSave = async () => {
    try { await saveFn({ data: { id: post.id, on: !post.savedByMe } }); void qc.invalidateQueries({ queryKey: ["social-post", post.id] }); } catch { newToast("Couldn't save. Try again."); }
  };

  return (
    <div className="redesign-step3 fixed inset-0 overflow-y-auto bg-white pb-[calc(32px+env(safe-area-inset-bottom))]" style={{ color: INK }} data-scroll-root>
      <PostTopBar
        title="Posts"
        left={<button type="button" aria-label="Back" onClick={back} className="flex h-11 w-11 items-center justify-center"><ChevronLeft size={26} /></button>}
        right={post.isMine ? <button type="button" aria-label="Post options" onClick={() => setMenu(true)} className="flex h-11 w-11 items-center justify-center"><MoreHorizontal size={22} /></button> : undefined}
      />
      <div className="flex items-center gap-2.5 px-4 pb-3">
        <CrewAvatar member={post.author} size={36} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold">{post.isMine ? "You" : post.author.name}</div>
          <div className="text-[12px]" style={{ color: MUTED }}>{clock(post.createdAt)}</div>
        </div>
      </div>
      <PostCarousel items={post.items} />
      {post.caption && <p className="whitespace-pre-wrap break-words px-4 pt-3 text-[15px]" style={{ lineHeight: 1.4 }}>{post.caption}</p>}
      {post.workout && <PostWorkoutCard workout={post.workout} isMine={post.isMine} postId={post.id} author={null} />}
      <div className="flex items-center gap-5 px-4 pt-4 text-[14px] font-bold">
        <span className="flex items-center gap-1.5"><Flame size={18} aria-hidden /> {post.cheers} {post.cheers === 1 ? "cheer" : "cheers"}</span>
        <button type="button" onClick={() => setComments(true)} className="flex h-9 items-center gap-1.5"><MessageCircle size={18} aria-hidden /> {post.comments} {post.comments === 1 ? "comment" : "comments"}</button>
        {post.isMine ? (
          <span className="flex items-center gap-1.5"><Bookmark size={18} aria-hidden /> {post.saves} {post.saves === 1 ? "save" : "saves"}</span>
        ) : (
          <button type="button" aria-pressed={post.savedByMe} onClick={() => void toggleSave()} className="flex h-9 items-center gap-1.5"><Bookmark size={18} fill={post.savedByMe ? "currentColor" : "none"} aria-hidden /> {post.savedByMe ? "Saved" : "Save"}</button>
        )}
      </div>

      <NewSheet open={menu} onOpenChange={setMenu} title="Post" hideTitle description="Post options">
        <NewSheetRow simple title="Edit caption" leading={<NewSheetMenuIcon><Pencil /></NewSheetMenuIcon>} onClick={() => { setMenu(false); setCaption(post.caption); setEditing(true); }} />
        <NewSheetRow simple destructive title="Delete" leading={<NewSheetMenuIcon><Trash2 /></NewSheetMenuIcon>} onClick={() => { setMenu(false); setConfirm(true); }} />
      </NewSheet>
      <NewSheet open={editing} onOpenChange={setEditing} title="Edit caption">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} rows={4} aria-label="Caption" className="w-full resize-none rounded-[14px] bg-[var(--new-control)] p-3 text-[16px] outline-none" />
        <NewSheetButton disabled={busy} onClick={() => void saveCaption()}>Save</NewSheetButton>
      </NewSheet>
      <NewConfirm open={confirm} onOpenChange={setConfirm} title="Delete this post?" subtitle="It's removed from your profile and your crews." action="Delete" busy={busy} error={err} onConfirm={() => void remove()} />
      <PostCommentsSheet postId={post.id} open={comments} onOpenChange={setComments} canComment={post.commentsOn} />
    </div>
  );
}
