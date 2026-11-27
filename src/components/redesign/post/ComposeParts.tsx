import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Globe, Lock, Users, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPostComposeContext, getTaggablePeople } from "@/lib/posts.functions";
import { audienceLabel, audienceOptions, defaultAudience, selectAudience, type AudienceContext, type PostAudience } from "@/lib/post-audience";
import { NewSheet, NewSheetCheckbox, NewSheetRadio, NewSheetRow } from "../NewSheet";
import { INK, MUTED } from "./PostBits";

export function useComposeContext() {
  return useQuery({ queryKey: ["post-compose-context"], queryFn: () => getPostComposeContext(), staleTime: 60_000 });
}
export function useAudience(ctx: AudienceContext | undefined) {
  const [audience, setAudience] = useState<PostAudience | null>(null);
  return { audience: audience ?? (ctx ? defaultAudience(ctx) : { kind: "only_me" as const, crewIds: [] }), setAudience };
}

export function SheetActions({ title, cancel, done, disabled = false }: { title: string; cancel: () => void; done?: () => void; disabled?: boolean }) {
  return <div className="mb-3 grid grid-cols-[64px_1fr_64px] items-center">
    <Button variant="ghost" onClick={cancel} className="h-11 px-0 text-[14px] font-semibold">Cancel</Button>
    <h2 className="text-center text-[20px] font-extrabold">{title}</h2>
    {done ? <Button variant="ghost" disabled={disabled} onClick={done} className="h-11 px-0 text-[14px] font-bold text-[var(--new-purple)]">Done</Button> : <span />}
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
  return <section className="px-4 pt-5 text-[var(--new-ink)]">
    {showTitle && <h2 className="text-[15px] font-extrabold">Who sees it</h2>}
    <div className="mt-2" role={soloTeen ? undefined : "radiogroup"} aria-label="Who sees it">
      {options.map(kind => {
        const selected = audience.kind === kind;
        const Icon = kind === "everyone" ? ctx.isPrivate ? UserCheck : Globe : kind === "crews" ? Users : Lock;
        const subtitle = kind === "everyone" ? ctx.isPrivate ? ctx.crews.length ? "People you approve, plus your crews" : "People you approve" : ctx.crews.length ? "Followers, Discover and your crews" : "Followers and Discover" : kind === "crews" ? selectedNames || ctx.crews.map(c => c.name).join(", ") : soloTeen ? "Join a crew to share your posts with others" : "Just you, on your profile";
        if (soloTeen) return <div key={kind} className="flex min-h-[72px] items-center gap-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--new-control)] text-[var(--new-muted)]"><Lock size={18} /></span><div><div className="text-[16px] font-bold">Only me</div><div className="mt-0.5 text-[13px] text-[var(--new-muted)]">Join a crew to share your posts with others</div></div></div>;
        return <div key={kind} className="relative flex items-center border-b border-[var(--new-divider)] last:border-0">
          <Button variant="ghost" role={soloTeen ? undefined : "radio"} aria-checked={soloTeen ? undefined : selected} onClick={() => { if (!soloTeen) onChange(selectAudience(kind, ctx, kind === "crews" && audience.kind === "crews" ? audience.crewIds : undefined)); }} className="h-auto min-h-[72px] w-full justify-start gap-3 whitespace-normal rounded-none px-0 py-3 text-left hover:bg-transparent">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${selected && !soloTeen ? "bg-[var(--new-purple)] text-[var(--new-white)]" : "bg-[var(--new-control)] text-[var(--new-muted)]"}`}><Icon className="!size-[18px]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold">{audienceLabel({ kind, crewIds: [] }, ctx.isPrivate)}</span><span className={`mt-0.5 block truncate text-[13px] font-normal text-[var(--new-muted)] ${kind === "crews" && ctx.crews.length > 1 ? "pr-[64px]" : ""}`}>{subtitle}</span></span>
            {!soloTeen && <NewSheetRadio checked={selected} />}
          </Button>
          {kind === "crews" && ctx.crews.length > 1 && <Button variant="ghost" onClick={openCrews} className="absolute bottom-[7px] right-[30px] h-9 px-1 text-[13px] font-bold text-[var(--new-purple)]">· Change</Button>}
        </div>;
      })}
    </div>
    <NewSheet open={open} onOpenChange={setOpen} title="Which crews?" hideTitle>
      <SheetActions title="Which crews?" cancel={() => setOpen(false)} disabled={!chosen.length} done={() => { onChange(selectAudience("crews", ctx, chosen)); setOpen(false); }} />
      {ctx.crews.map(c => <NewSheetRow key={c.id} role="checkbox" aria-checked={chosen.includes(c.id)} title={c.name} subtitle={`${c.members ?? 0} ${(c.members ?? 0) === 1 ? "member" : "members"}`} trailing={<NewSheetCheckbox checked={chosen.includes(c.id)} />} onClick={() => setChosen(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])} />)}
      <p className="pt-3 text-[13px] text-[var(--new-muted)]">Pick at least one. Done stays grey until you do.</p>
    </NewSheet>
  </section>;
}

/** "Tag people ›" and "Comments On ›" rows with their sheets. */
export function PostOptionRows({ tags, setTags, commentsOn, setCommentsOn }: { tags: string[]; setTags: (t: string[]) => void; commentsOn: boolean; setCommentsOn: (on: boolean) => void }) {
  const [tagOpen, setTagOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const people = useQuery({ queryKey: ["post-taggable"], queryFn: () => getTaggablePeople(), enabled: tagOpen, staleTime: 60_000 });
  const row = "flex h-[52px] w-full items-center justify-between border-t text-left text-[16px] font-semibold";
  return (
    <section className="mx-4 mt-5" style={{ color: INK }}>
      <button type="button" className={row} style={{ borderColor: "var(--new-divider)" }} onClick={() => setTagOpen(true)}>
        <span>Tag people</span>
        <span className="flex items-center gap-1 text-[14px] font-normal" style={{ color: MUTED }}>{tags.length ? `${tags.length} tagged` : ""}<ChevronRight size={20} style={{ color: "var(--new-chevron)" }} /></span>
      </button>
      <button type="button" className={row} style={{ borderColor: "var(--new-divider)", borderBottomWidth: 1 }} onClick={() => setCommentsOpen(true)}>
        <span>Comments</span>
        <span className="flex items-center gap-1 text-[14px] font-normal" style={{ color: MUTED }}>{commentsOn ? "On" : "Off"}<ChevronRight size={20} style={{ color: "var(--new-chevron)" }} /></span>
      </button>
      <NewSheet open={tagOpen} onOpenChange={setTagOpen} title="Tag people" subtitle="Your crewmates">
        {people.isLoading ? <div className="h-24 animate-pulse rounded-[16px] bg-[var(--new-control)]" /> : (people.data ?? []).length === 0 ? (
          <p className="py-3 text-[14px]" style={{ color: MUTED }}>No one to tag yet.</p>
        ) : (people.data ?? []).map((p) => (
          <NewSheetRow key={p.id} simple title={p.name} trailing={<NewSheetCheckbox checked={tags.includes(p.id)} />} onClick={() => setTags(tags.includes(p.id) ? tags.filter((t) => t !== p.id) : [...tags, p.id])} />
        ))}
      </NewSheet>
      <NewSheet open={commentsOpen} onOpenChange={setCommentsOpen} title="Comments">
        <NewSheetRow simple title="On" trailing={<NewSheetRadio checked={commentsOn} />} onClick={() => { setCommentsOn(true); setCommentsOpen(false); }} />
        <NewSheetRow simple title="Off" trailing={<NewSheetRadio checked={!commentsOn} />} onClick={() => { setCommentsOn(false); setCommentsOpen(false); }} />
      </NewSheet>
    </section>
  );
}
