import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberProfileLink } from "@/components/profile/MemberProfileLink";
import { tagSections, withLineParts, type TaggablePerson } from "@/lib/post-tags";
import type { SocialPostView } from "@/lib/social-post-types";
import { NewSheet, NewSheetCheckbox } from "../NewSheet";
import { CrewAvatar } from "../CrewAvatars";
import { FollowPill } from "../FollowPill";
import { SheetActions } from "./ComposeParts";

const avatar = (p: { id: string; name: string; avatar?: string | null; avatarUrl?: string | null; avatarColor?: string | null }) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl ?? p.avatar ?? null, avatarColor: p.avatarColor ?? "#7C3AED" });

/** 73a: Cancel / Tag people / Done, search, Your crews and People you follow. */
export function TagPeopleSheet({ open, onOpenChange, people, loading, tags, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; people: TaggablePerson[]; loading: boolean; tags: string[]; onDone: (t: string[]) => void }) {
  const [draft, setDraft] = useState<string[]>(tags);
  const [query, setQuery] = useState("");
  useEffect(() => { if (open) { setDraft(tags); setQuery(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const { crew, follow } = tagSections(people, query);
  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const section = (label: string, list: TaggablePerson[]) => list.length > 0 && (
    <section>
      <h3 className="mb-1 mt-4 text-[13px] font-extrabold tracking-[0.04em] text-[var(--new-muted)]">{label}</h3>
      {list.map((p) => (
        <Button key={p.id} variant="ghost" role="checkbox" aria-checked={draft.includes(p.id)} onClick={() => toggle(p.id)} className="flex h-auto w-full items-center gap-3 rounded-none px-0 py-2 text-left hover:bg-transparent">
          <CrewAvatar member={avatar(p)} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold text-[var(--new-ink)]">{p.name}</span>
            <span className="block truncate text-[13px] font-normal text-[var(--new-muted)]">{p.section === "crew" ? p.crew : p.username ? `@${p.username}` : ""}</span>
          </span>
          <NewSheetCheckbox checked={draft.includes(p.id)} canvas />
        </Button>
      ))}
    </section>
  );
  return (
    <NewSheet open={open} onOpenChange={onOpenChange} title="Tag people" hideTitle compose>
      <div className="min-h-[70dvh]">
        <SheetActions title="Tag people" cancel={() => onOpenChange(false)} done={() => { onDone(draft); onOpenChange(false); }} />
        <label className="flex h-11 items-center gap-2.5 rounded-[14px] bg-[var(--new-control)] px-3.5">
          <Search className="size-5 shrink-0 text-[var(--new-muted)]" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people" className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--new-ink)] outline-hidden placeholder:text-[var(--new-muted)]" />
        </label>
        {loading ? <div className="mt-4 h-24 animate-pulse rounded-[16px] bg-[var(--new-control)]" /> : !people.length ? (
          <p className="py-6 text-center text-[14px] text-[var(--new-muted)]">No one to tag yet.</p>
        ) : <>
          {section("YOUR CREWS", crew)}
          {section("PEOPLE YOU FOLLOW", follow)}
          {!crew.length && !follow.length && <p className="py-6 text-center text-[14px] text-[var(--new-muted)]">No matches.</p>}
        </>}
        <p className="mx-2 mt-5 text-center text-[12px] leading-[1.45] text-[var(--new-muted)]">They'll get a notification. Only people who can see this post are listed.</p>
      </div>
    </NewSheet>
  );
}

/** 73e: "with you and Chris · FitFam · 2h", one line; the "with" part opens the Tagged sheet (73f). */
export function PostSubline({ post, viewerId, rest, className = "truncate" }: { post: SocialPostView; viewerId: string | null; rest: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const parts = withLineParts(post.tagged, viewerId);
  return <>
    <div className={`text-[12px] text-[var(--new-muted)] ${className}`}>
      {parts.length > 0 && <>
        <button type="button" onClick={() => setOpen(true)} className="inline p-0 text-inherit" aria-label="See who's tagged">
          {parts.map((p, i) => p.bold ? <strong key={i} className="font-bold text-[var(--new-ink)]">{p.text}</strong> : <span key={i}>{p.text}</span>)}
        </button>
        {" · "}
      </>}
      {rest}
    </div>
    {parts.length > 0 && <TaggedSheet open={open} onOpenChange={setOpen} tagged={post.tagged} viewerId={viewerId} />}
  </>;
}

/** 73f: tagged people with Follow / Following / Requested; your own row says You. */
export function TaggedSheet({ open, onOpenChange, tagged, viewerId }: { open: boolean; onOpenChange: (o: boolean) => void; tagged: SocialPostView["tagged"]; viewerId: string | null }) {
  const sorted = [...tagged.filter((t) => t.id === viewerId), ...tagged.filter((t) => t.id !== viewerId)];
  return (
    <NewSheet open={open} onOpenChange={onOpenChange} title="Tagged" hideTitle compose>
      <div className="min-h-[40dvh]">
        <h2 className="mb-3 text-center text-[17px] font-bold text-[var(--new-ink)]" aria-hidden>Tagged</h2>
        {sorted.map((t) => {
          const you = t.id === viewerId;
          return (
            <div key={t.id} className="flex items-center gap-3 py-2">
              <MemberProfileLink userId={t.id} isYou={you} className="flex min-w-0 flex-1 items-center gap-3">
                <CrewAvatar member={avatar(t)} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-bold text-[var(--new-ink)]">{t.name}</span>
                  {t.username && <span className="block truncate text-[13px] text-[var(--new-muted)]">@{t.username}</span>}
                </span>
              </MemberProfileLink>
              {you ? <span className="shrink-0 text-[14px] text-[var(--new-muted)]">You</span> : <span className="shrink-0"><FollowPill userId={t.id} /></span>}
            </div>
          );
        })}
      </div>
    </NewSheet>
  );
}
