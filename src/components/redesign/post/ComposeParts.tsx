import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Globe, Lock, Users, UserCheck, Tag, MessageCircleOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPostComposeContext, getTaggablePeople } from "@/lib/posts.functions";
import { audienceLabel, audienceOptions, defaultAudience, selectAudience, type AudienceContext, type PostAudience } from "@/lib/post-audience";
import { cn } from "@/lib/utils";
import { pruneTags, tagRowLabel } from "@/lib/post-tags";
import { TagPeopleSheet } from "./PostTags";
import { NewSheet, NewSheetCheckbox, NewSheetRadio, NewSheetRow } from "../NewSheet";
import { MUTED } from "./PostBits";

export function useComposeContext() {
  return useQuery({ queryKey: ["post-compose-context"], queryFn: () => getPostComposeContext(), staleTime: 60_000 });
}
export function useAudience(ctx: AudienceContext | undefined) {
  const [audience, setAudience] = useState<PostAudience | null>(null);
  return { audience: audience ?? (ctx ? defaultAudience(ctx) : { kind: "only_me" as const, crewIds: [] }), setAudience };
}

export function SheetActions({ title, cancel, done, disabled = false, className }: { title: string; cancel: () => void; done?: () => void; disabled?: boolean; className?: string }) {
  return <div className={cn("mb-3 grid grid-cols-[70px_1fr_70px] items-center", className)}>
    <Button variant="ghost" onClick={cancel} className="h-11 justify-start px-0 text-[15px] font-normal text-[var(--new-muted)] hover:bg-transparent hover:text-[var(--new-muted)]">Cancel</Button>
    <h2 className="text-center text-[17px] font-bold">{title}</h2>
    {done ? <Button variant="ghost" disabled={disabled} onClick={done} className="h-11 justify-end px-0 text-[15px] font-bold text-[var(--new-purple)] hover:bg-transparent hover:text-[var(--new-purple)]">Done</Button> : <span />}
  </div>;
}

/** Shared radio audience block. No helper below it. */
export function WhoSeesIt({ ctx, audience, onChange, showTitle = true }: { ctx: AudienceContext; audience: PostAudience; onChange: (a: PostAudience) => void; showTitle?: boolean }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const options = audienceOptions(ctx);
  const soloTeen = ctx.under18 && !ctx.crews.length;
  const selectedNames = ctx.crews.filter(c => audience.kind !== "crews" || audience.crewIds.includes(c.id)).map(c => c.name).join(", ");
  const openCrews = () => { setChosen(audience.kind === "crews" ? audience.crewIds : ctx.crews.map(c => c.id)); setOpen(true); };
  return <section role={soloTeen ? undefined : "radiogroup"} aria-label="Who sees it" className={showTitle ? "mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] px-4 pb-0.5 pt-3.5 text-[var(--new-ink)]" : "text-[var(--new-ink)]"}>
    {showTitle && <h2 className="mb-0.5 text-[16px] font-extrabold">Who sees it</h2>}
    <div>
      {options.map(kind => {
        const selected = audience.kind === kind;
        const Icon = kind === "everyone" ? ctx.isPrivate ? UserCheck : Globe : kind === "crews" ? Users : Lock;
        const subtitle = kind === "everyone" ? ctx.isPrivate ? ctx.crews.length ? "People you approve, plus your crews" : "People you approve" : ctx.crews.length ? "Followers, Discover and your crews" : "Followers and Discover" : kind === "crews" ? selectedNames || ctx.crews.map(c => c.name).join(", ") : soloTeen ? "Join a crew to share your posts with others" : "Just you, on your profile";
        if (soloTeen) return <div key={kind} className="flex items-center gap-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--new-soft)] text-[var(--new-purple)]"><Lock size={18} /></span><div className="min-w-0 flex-1"><div className="text-[15px] font-semibold">Only me</div><div className="mt-px text-[12px] text-[var(--new-muted)]">{subtitle}</div></div></div>;
        const label = audienceLabel({ kind, crewIds: [] }, ctx.isPrivate);
        return <div key={kind} className="relative flex items-center gap-3 border-b border-[var(--new-divider)] py-3 last:border-0">
          <Button variant="ghost" role="radio" aria-label={`${label} ${subtitle}`} aria-checked={selected} onClick={() => onChange(selectAudience(kind, ctx, kind === "crews" && audience.kind === "crews" ? audience.crewIds : undefined))} className="absolute inset-0 h-full w-full rounded-none p-0 hover:bg-transparent" />
          <span className={`pointer-events-none relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${selected ? "bg-[var(--new-soft)] text-[var(--new-purple)]" : "bg-[var(--new-control)] text-[var(--new-ink-deep)]"}`}><Icon className="!size-[18px]" /></span>
          <span className="pointer-events-none relative min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{label}</span>
            <span className="mt-px block text-[12px] font-normal leading-normal text-[var(--new-muted)]">
              <span>{subtitle}</span>
              {kind === "crews" && ctx.crews.length > 1 && <Button variant="ghost" onClick={openCrews} className="pointer-events-auto ml-1 inline h-auto rounded-none p-0 align-baseline text-[12px] font-bold leading-normal text-[var(--new-purple)] hover:bg-transparent hover:text-[var(--new-purple)]">· Change</Button>}
            </span>
          </span>
          <span className="pointer-events-none relative shrink-0"><NewSheetRadio checked={selected} variant="inset" className={selected ? "" : "border-[var(--new-post-radio-off)]"} /></span>
        </div>;
      })}
    </div>
    <NewSheet open={open} onOpenChange={setOpen} title="Which crews?" hideTitle compose>
      <SheetActions title="Which crews?" className="mb-1" cancel={() => setOpen(false)} disabled={!chosen.length} done={() => { onChange(selectAudience("crews", ctx, chosen)); setOpen(false); }} />
      {ctx.crews.map(c => <NewSheetRow key={c.id} role="checkbox" aria-checked={chosen.includes(c.id)} title={c.name} titleClassName="text-[15px] font-semibold" subtitle={`${c.members ?? 0} ${(c.members ?? 0) === 1 ? "member" : "members"}`} subtitleClassName="mt-0 text-[12px]" className="py-3.5" trailing={<NewSheetCheckbox checked={chosen.includes(c.id)} canvas />} onClick={() => setChosen(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])} />)}
      <p className="mt-2 text-center text-[12px] text-[var(--new-disabled-text)]">Pick at least one. Done stays grey until you do.</p>
    </NewSheet>
  </section>;
}

/** "Tag people ›" and "Comments On ›" rows with their sheets. Only people who can see the post with this audience are listed. */
export function PostOptionRows({ tags, setTags, commentsOn, setCommentsOn, audience }: { tags: string[]; setTags: (t: string[]) => void; commentsOn: boolean; setCommentsOn: (on: boolean) => void; audience: PostAudience }) {
  const [tagOpen, setTagOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const people = useQuery({ queryKey: ["post-taggable", audience.kind, audience.crewIds.join(",")], queryFn: () => getTaggablePeople({ data: { audience: audience.kind, crewIds: audience.crewIds } }), enabled: audience.kind !== "only_me", staleTime: 60_000 });
  const allowed = people.data?.map((p) => p.id) ?? null;
  // Audience changed: drop tags for people who can no longer see the post.
  useEffect(() => {
    const next = pruneTags(tags, audience.kind, allowed);
    if (next.length !== tags.length) setTags(next);
  }, [allowed?.join(","), audience.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const names = tags.map((id) => people.data?.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
  const row = "flex h-auto w-full items-center justify-between gap-3 rounded-none px-0 py-3.5 text-left text-[15px] font-semibold hover:bg-transparent";
  return (
    <section className="mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] px-4 text-[var(--new-ink-deep)]">
      <Button variant="ghost" className={`${row} border-b border-[var(--new-divider)]`} onClick={() => setTagOpen(true)}>
        <Tag className="!size-5 shrink-0" /><span className="shrink-0">Tag people</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-[14px] font-normal" style={{ color: "var(--new-disabled-text)" }}><span className="truncate">{tagRowLabel(names)}</span><ChevronRight className="!size-4 shrink-0" style={{ color: "var(--new-chevron)" }} /></span>
      </Button>
      <TagPeopleSheet open={tagOpen} onOpenChange={setTagOpen} people={people.data ?? []} loading={people.isLoading} tags={tags} onDone={setTags} />
      <Button variant="ghost" className={row} onClick={() => setCommentsOpen(true)}>
        <MessageCircleOff className="!size-5 shrink-0" /><span className="flex-1">Comments</span>
        <span className="flex items-center gap-1 text-[14px] font-normal" style={{ color: MUTED }}>{commentsOn ? "On" : "Off"}<ChevronRight className="!size-4" style={{ color: "var(--new-chevron)" }} /></span>
      </Button>
      <NewSheet open={commentsOpen} onOpenChange={setCommentsOpen} title="Comments" compose>
        <NewSheetRow simple title="On" trailing={<NewSheetRadio checked={commentsOn} />} onClick={() => { setCommentsOn(true); setCommentsOpen(false); }} />
        <NewSheetRow simple title="Off" trailing={<NewSheetRadio checked={!commentsOn} />} onClick={() => { setCommentsOn(false); setCommentsOpen(false); }} />
      </NewSheet>
    </section>
  );
}
