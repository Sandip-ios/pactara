import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, ChevronLeft, ChevronRight, Flame, MessageCircle, MoreHorizontal, Pencil, Pin, Trash2, Users } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { deleteSocialPost, getSocialPost, toggleSocialPostPin, toggleSocialPostSave, updateSocialPostAudience, updateSocialPostContent } from "@/lib/posts.functions";
import { clock } from "@/components/TimelineCard";
import { NewSheet, NewSheetMenuIcon, NewSheetRow, NewSheetButton } from "../NewSheet";
import { NewConfirm } from "../NewConfirm";
import { newToast } from "../new-toast";
import { CrewAvatar } from "../CrewAvatars";
import { PostCarousel, PostWorkoutCard, INK, MUTED, PostTopBar } from "./PostBits";
import { WhoSeesIt, useComposeContext, SheetActions } from "./ComposeParts";
import { WorkoutAttachment } from "./WorkoutAttachment";
import { audienceLabel, defaultAudience, type PostAudience } from "@/lib/post-audience";
import type { PostWorkoutChoice, SocialPostView } from "@/lib/social-post-types";
import { PostCommentsSheet } from "./PostComments";

function editChoice(post: SocialPostView): PostWorkoutChoice {
  const workout = post.workout;
  if (!workout) return null;
  if (workout.source === "caption") return { source: "caption", moves: workout.moves.map((m) => ({ exerciseId: m.exerciseId, name: m.name, imageStart: m.imageStart, sets: m.sets.length, reps: m.sets[0]?.reps ?? 10 })) };
  if (workout.source === "session" && post.workoutSessionId) return { source: "session", id: post.workoutSessionId };
  if (workout.source === "saved" && post.workoutId) return { source: "saved", id: post.workoutId };
  return null;
}

/** One post: carousel, caption, workout and the owner's exact canvas menu. */
export function NewOwnPost({ postId }: { postId: string }) {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: post, isLoading } = useQuery({ queryKey: ["social-post", postId], queryFn: () => getSocialPost({ data: { id: postId } }) });
  const delFn = useServerFn(deleteSocialPost);
  const contentFn = useServerFn(updateSocialPostContent);
  const saveFn = useServerFn(toggleSocialPostSave);
  const pinFn = useServerFn(toggleSocialPostPin);
  const ctx = useComposeContext();
  const audienceFn = useServerFn(updateSocialPostAudience);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [nextAudience, setNextAudience] = useState<PostAudience>({ kind: "only_me", crewIds: [] });
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [workout, setWorkout] = useState<PostWorkoutChoice>(null);
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
  const openEditor = () => {
    setMenu(false);
    setCaption(post.caption);
    setWorkout(editChoice(post));
    setEditing(true);
  };
  const saveContent = async () => {
    setBusy(true);
    try {
      await contentFn({ data: { id: post.id, caption, workout } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["social-post", post.id] }), qc.invalidateQueries({ queryKey: ["my-social-posts"] }), qc.invalidateQueries({ queryKey: ["crew-social-posts"] })]);
      setEditing(false);
    } catch { newToast("Couldn't save. Try again."); } finally { setBusy(false); }
  };
  const saveAudience = async () => {
    setBusy(true);
    try {
      await audienceFn({ data: { id: post.id, audience: nextAudience } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["social-post", post.id] }), qc.invalidateQueries({ queryKey: ["my-social-posts"] }), qc.invalidateQueries({ queryKey: ["crew-social-posts"] }), qc.invalidateQueries({ queryKey: ["post-compose-context"] })]);
      setAudienceOpen(false);
    } catch (e) { newToast(e instanceof Error ? e.message : "Couldn't save. Try again."); } finally { setBusy(false); }
  };
  const toggleSave = async () => {
    try { await saveFn({ data: { id: post.id, on: !post.savedByMe } }); void qc.invalidateQueries({ queryKey: ["social-post", post.id] }); } catch { newToast("Couldn't save. Try again."); }
  };
  const togglePin = async () => {
    setMenu(false);
    try {
      await pinFn({ data: { id: post.id, on: !post.pinnedAt } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["social-post", post.id] }), qc.invalidateQueries({ queryKey: ["my-social-posts"] })]);
      newToast(post.pinnedAt ? "Unpinned from your profile" : "Pinned to your profile", { success: true });
    } catch { newToast("Couldn't update the pin. Try again."); }
  };
  const chevron = <ChevronRight size={16} className="shrink-0 text-[var(--new-chevron)]" aria-hidden />;

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

      <NewSheet open={menu} onOpenChange={setMenu} title="Post" hideTitle description="Post options" compose>
        <NewSheetRow simple className="h-14! py-0!" title="Edit caption and workout" leading={<NewSheetMenuIcon size={22}><Pencil /></NewSheetMenuIcon>} trailing={chevron} onClick={openEditor} />
        <NewSheetRow simple className="h-14! py-0!" title="Who sees it" leading={<NewSheetMenuIcon size={22}><Users /></NewSheetMenuIcon>} trailing={<span className="flex items-center gap-2"><span className="text-[13px] font-normal text-[var(--new-muted)]">{audienceLabel({ kind: post.audience, crewIds: post.crewIds }, ctx.data?.isPrivate ?? false)}</span>{chevron}</span>} onClick={() => { setMenu(false); setNextAudience(ctx.data ? defaultAudience({ ...ctx.data, remembered: { kind: post.audience, crewIds: post.crewIds } }) : { kind: post.audience, crewIds: post.crewIds }); setAudienceOpen(true); }} />
        <NewSheetRow simple className="h-14! py-0!" title={post.pinnedAt ? "Unpin from your profile" : "Pin to your profile"} leading={<NewSheetMenuIcon size={22}><Pin /></NewSheetMenuIcon>} onClick={() => void togglePin()} />
        <NewSheetRow simple destructive className="h-14! py-0!" title="Delete" leading={<span className="text-[var(--new-destructive)]"><NewSheetMenuIcon size={22}><Trash2 /></NewSheetMenuIcon></span>} onClick={() => { setMenu(false); setConfirm(true); }} />
      </NewSheet>
      <NewSheet open={editing} onOpenChange={setEditing} title="Edit caption and workout" compose>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} rows={4} aria-label="Caption" className="w-full resize-none rounded-[14px] bg-[var(--new-control)] p-3 text-[16px] outline-none" />
        {ctx.data ? <div className="mt-3 rounded-[16px] border border-[var(--new-divider)] px-3"><WorkoutAttachment ctx={ctx.data} suggestions={[]} workout={workout} onChange={setWorkout} /></div> : <div className="mt-3 h-14 animate-pulse rounded-[14px] bg-[var(--new-control)]" />}
        <NewSheetButton disabled={busy || !ctx.data} onClick={() => void saveContent()}>Save</NewSheetButton>
      </NewSheet>
      <NewSheet open={audienceOpen} onOpenChange={setAudienceOpen} title="Who sees it" hideTitle compose>
        <SheetActions title="Who sees it" cancel={() => setAudienceOpen(false)} disabled={busy || !ctx.data} done={() => void saveAudience()} />
        {ctx.data && <WhoSeesIt ctx={ctx.data} audience={nextAudience} onChange={setNextAudience} showTitle={false} />}
      </NewSheet>
      <NewConfirm open={confirm} onOpenChange={setConfirm} title="Delete this post?" subtitle="It's removed from your profile and your crews." action="Delete" busy={busy} error={err} onConfirm={() => void remove()} />
      <PostCommentsSheet postId={post.id} open={comments} onOpenChange={setComments} canComment={post.commentsOn} />
    </div>
  );
}
