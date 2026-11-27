import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Pencil, Pin, Trash2, Users } from "lucide-react";
import { deleteSocialPost, toggleSocialPostPin, updateSocialPostAudience, updateSocialPostContent } from "@/lib/posts.functions";
import { NewSheet, NewSheetMenuIcon, NewSheetRow, NewSheetButton } from "../NewSheet";
import { NewConfirm } from "../NewConfirm";
import { newToast } from "../new-toast";
import { WhoSeesIt, useComposeContext, SheetActions } from "./ComposeParts";
import { WorkoutAttachment } from "./WorkoutAttachment";
import { audienceLabel, defaultAudience, type PostAudience } from "@/lib/post-audience";
import type { PostWorkoutChoice, SocialPostView } from "@/lib/social-post-types";

function editChoice(post: SocialPostView): PostWorkoutChoice {
  const workout = post.workout;
  if (!workout) return null;
  if (workout.source === "caption") return { source: "caption", moves: workout.moves.map((m) => ({ exerciseId: m.exerciseId, name: m.name, imageStart: m.imageStart, sets: m.sets.length, reps: m.sets[0]?.reps ?? 10 })) };
  if (workout.source === "session" && post.workoutSessionId) return { source: "session", id: post.workoutSessionId };
  if (workout.source === "saved" && post.workoutId) return { source: "saved", id: post.workoutId };
  return null;
}

const POST_LISTS = [["home-social-posts"], ["my-social-posts"], ["crew-social-posts"]] as const;

/** The owner's post menu (edit, who sees it, pin, delete): one copy for the own-post view and every feed card. */
export function OwnPostMenu({ post, open, onOpenChange, onDeleted }: { post: SocialPostView; open: boolean; onOpenChange: (o: boolean) => void; onDeleted?: () => void }) {
  const menu = open;
  const setMenu = onOpenChange;
  const qc = useQueryClient();
  const delFn = useServerFn(deleteSocialPost);
  const contentFn = useServerFn(updateSocialPostContent);
  const pinFn = useServerFn(toggleSocialPostPin);
  const audienceFn = useServerFn(updateSocialPostAudience);
  const ctx = useComposeContext();
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [nextAudience, setNextAudience] = useState<PostAudience>({ kind: "only_me", crewIds: [] });
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [workout, setWorkout] = useState<PostWorkoutChoice>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const refreshLists = () => Promise.all([qc.invalidateQueries({ queryKey: ["social-post", post.id] }), ...POST_LISTS.map((k) => qc.invalidateQueries({ queryKey: [...k] }))]);
  const remove = async () => {
    setBusy(true);
    setErr(null);
    try {
      await delFn({ data: { id: post.id } });
      await Promise.all(POST_LISTS.map((k) => qc.invalidateQueries({ queryKey: [...k] })));
      newToast("Post deleted", { success: true });
      setConfirm(false);
      setBusy(false);
      onDeleted?.();
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
      await refreshLists();
      setEditing(false);
    } catch { newToast("Couldn't save. Try again."); } finally { setBusy(false); }
  };
  const saveAudience = async () => {
    setBusy(true);
    try {
      await audienceFn({ data: { id: post.id, audience: nextAudience } });
      await Promise.all([refreshLists(), qc.invalidateQueries({ queryKey: ["post-compose-context"] })]);
      setAudienceOpen(false);
    } catch (e) { newToast(e instanceof Error ? e.message : "Couldn't save. Try again."); } finally { setBusy(false); }
  };
  const togglePin = async () => {
    setMenu(false);
    try {
      await pinFn({ data: { id: post.id, on: !post.pinnedAt } });
      await refreshLists();
      newToast(post.pinnedAt ? "Unpinned from your profile" : "Pinned to your profile", { success: true });
    } catch { newToast("Couldn't update the pin. Try again."); }
  };
  const chevron = <ChevronRight size={16} className="shrink-0 text-[var(--new-chevron)]" aria-hidden />;
  return (
    <>
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
      <NewConfirm open={confirm} onOpenChange={setConfirm} title="Delete this post?" subtitle="It'll be removed from your profile and your crews' feeds. This can't be undone." action="Delete" busy={busy} error={err} onConfirm={() => void remove()} />
    </>
  );
}
