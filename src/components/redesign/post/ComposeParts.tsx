import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { getPostComposeContext, getTaggablePeople } from "@/lib/posts.functions";
import { defaultAudience, toggleCrew, toggleEveryone, type PostAudience } from "@/lib/post-audience";
import { NewSheet, NewSheetCheckbox, NewSheetRadio, NewSheetRow } from "../NewSheet";
import { AudienceChip, INK, MUTED } from "./PostBits";

export function useComposeContext() {
  return useQuery({ queryKey: ["post-compose-context"], queryFn: () => getPostComposeContext(), staleTime: 60_000 });
}

/** Audience state that starts with every chip on once crews load. */
export function useAudience(ctx: { crews: { id: string }[]; under18: boolean } | undefined) {
  const [audience, setAudience] = useState<PostAudience | null>(null);
  const value = audience ?? (ctx ? defaultAudience(ctx.crews.map((c) => c.id), ctx.under18) : { everyone: false, crewIds: [] });
  return {
    audience: value,
    toggleEveryone: () => setAudience(toggleEveryone(value, !!ctx?.under18)),
    toggleCrew: (id: string) => setAudience(toggleCrew(value, id, !!ctx?.under18)),
  };
}

/** "Who sees it": title, chips and one short grey line. */
export function WhoSeesIt({ ctx, audience, onEveryone, onCrew }: { ctx: { crews: { id: string; name: string }[]; under18: boolean }; audience: PostAudience; onEveryone: () => void; onCrew: (id: string) => void }) {
  return (
    <section className="px-4 pt-5">
      <h2 className="text-[15px] font-extrabold" style={{ color: INK }}>Who sees it</h2>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {!ctx.under18 && <AudienceChip label="Everyone" on={audience.everyone} onClick={onEveryone} />}
        {ctx.crews.map((c) => <AudienceChip key={c.id} label={c.name} on={audience.crewIds.includes(c.id)} onClick={() => onCrew(c.id)} />)}
      </div>
      <p className="mt-2 text-[13px]" style={{ color: MUTED }}>Posts don't count as check-ins.</p>
    </section>
  );
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
