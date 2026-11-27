import type { Meal } from "@/lib/meals";
import { fullMealLine } from "@/lib/meals";
import { Utensils } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canPost, clipLength, postButtonLabel, showAlreadyInNote, showTagCard, type ComposeCrew } from "@/lib/new-checkin-form";

export type ComposeTag = { id: string; emoji: string; label: string };
export type ComposeCrewChip = ComposeCrew & { emoji: string | null };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

function Clip({ src, isVideo }: { src: string; isVideo: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || !isVideo) return;
    if (reduced) { v.pause(); v.currentTime = 0; } else void v.play().catch(() => undefined);
  }, [reduced, isVideo, src]);
  return <>
    <button type="button" aria-label="Play clip full screen" onClick={() => setFull(true)} className="relative h-[184px] w-[104px] shrink-0 overflow-hidden rounded-[14px] bg-[var(--new-ink)]">
      {isVideo ? <video ref={ref} src={src} muted loop playsInline autoPlay={!reduced} preload="auto" className="h-full w-full object-cover"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => { const d = e.currentTarget.duration; setProgress(d ? e.currentTarget.currentTime / d : 0); }} />
        : <img src={src} alt="Your check-in" className="h-full w-full object-cover" />}
      {isVideo && reduced && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] text-[var(--new-white)]"><Play size={18} fill="currentColor" /></span></span>}
      {isVideo && <>
        <span className="absolute bottom-4 left-2 flex h-[22px] items-center rounded-full bg-[rgba(0,0,0,0.55)] px-2 text-[11px] font-bold text-[var(--new-white)]">{clipLength(duration || 5)}</span>
        <span className="absolute inset-x-2 bottom-[7px] h-[3px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.35)]"><span className="block h-full rounded-full bg-[var(--new-white)]" style={{ width: `${Math.round(progress * 100)}%` }} /></span>
      </>}
    </button>
    {full && <div role="dialog" aria-label="Your clip" className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--new-ink-deep)]">
      {isVideo ? <video src={src} autoPlay controls={false} loop playsInline className="h-full w-full object-contain" />
        : <img src={src} alt="Your check-in" className="h-full w-full object-contain" />}
      <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setFull(false)} className="absolute left-4 top-[calc(max(env(safe-area-inset-top),44px)+12px)] h-11 w-11 rounded-full bg-[var(--new-camera-control)] text-[var(--new-white)] hover:bg-[var(--new-camera-control)]"><X className="!size-5" /></Button>
    </div>}
  </>;
}

export function NewCheckInCompose(p: {
  src: string | null; isVideo: boolean;
  note: string; onNote: (v: string) => void;
  tags: ComposeTag[]; tag: string | null; onTag: (v: string | null) => void;
  hasHealth: boolean;
  meal?: Meal | null; onMeal?: () => void; onRemoveMeal?: () => void;
  attached: { title: string; line: string } | null;
  crews: ComposeCrewChip[]; selected: string[]; onSelected: (ids: string[]) => void;
  followers: boolean; onFollowers: (v: boolean) => void;
  posting: boolean; error: string | null; draftRestored: boolean; savingDraft: boolean;
  onBack: () => void; onPost: () => void; onDraft: () => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = ta.current; if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; } }, [p.note]);
  const toggle = (id: string) => p.onSelected(p.selected.includes(id) ? p.selected.filter((x) => x !== id) : [...p.selected, id]);
  const allowed = canPost(p.selected, p.posting);
  return <div className="redesign-step3 fixed inset-0 z-40 flex flex-col bg-[var(--new-bg)] text-left text-[var(--new-ink)]">
    <div data-scroll-root className="min-h-0 flex-1 overflow-y-auto pb-4">
      <header className="relative flex items-center justify-center bg-[var(--new-white)] px-4 pb-3 pt-new-top">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={p.onBack} className="absolute left-4 h-11 w-11 rounded-full bg-[var(--new-checkin-back)] hover:bg-[var(--new-checkin-back)]"><ChevronLeft className="!size-6" /></Button>
        <h1 className="flex h-11 items-center text-[17px] font-bold">New check-in</h1>
      </header>
      <section className="flex gap-3 bg-[var(--new-white)] px-4 py-[14px]">
        {p.src && <Clip src={p.src} isVideo={p.isVideo} />}
        <textarea ref={ta} value={p.note} maxLength={500} rows={3} onChange={(e) => p.onNote(e.target.value.slice(0, 500))} placeholder="Add a description" aria-label="Description"
          className="min-h-[60px] flex-1 resize-none overflow-hidden border-0 bg-transparent text-[16px] text-[var(--new-ink)] outline-none placeholder:text-[var(--new-muted)]" />
      </section>
      {showTagCard(p.hasHealth) && <section className="mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] py-4">
        <h2 className="px-4 text-[16px] font-bold">Tag it</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {p.tags.map((t) => { const on = p.tag === t.id; return <button key={t.id} type="button" aria-pressed={on} onClick={() => p.onTag(on ? null : t.id)}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold ${on ? "border-[1.5px] border-[#7C3AED] bg-[#F5F0FF] text-[#6D28D9]" : "border border-[#E7E3DE] bg-[var(--new-white)]"}`}>
            <span aria-hidden>{t.emoji}</span>{t.label}</button>; })}
        </div>
      </section>}
      {p.attached && <section className="mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] p-4">
        <p className="text-[11px] font-extrabold tracking-[1px] text-[#6D28D9]">WORKOUT ATTACHED</p>
        <p className="mt-1 text-[17px] font-extrabold">{p.attached.title}</p>
        {p.attached.line && <p className="mt-0.5 text-[13px] text-[var(--new-muted)]">{p.attached.line}</p>}
      </section>}
      {!p.hasHealth && <section className="mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] p-4">{p.meal ? <div className="p6-attached-head"><div><p className="p6-meal-kicker">MEAL</p><strong>{p.meal.name}</strong><p className="text-[12px] p6-muted">{fullMealLine(p.meal.snapshot)}</p></div><Button variant="ghost" className="p6-link text-[12px]" onClick={p.onMeal}>Change</Button><Button variant="ghost" className="p6-icon" aria-label="Remove meal" onClick={p.onRemoveMeal}><X size={16}/></Button></div> : <Button variant="ghost" className="w-full justify-start" onClick={p.onMeal}><Utensils size={18}/>Add a meal</Button>}</section>}
      <section className="mx-4 mt-3 rounded-[20px] bg-[var(--new-white)] p-4">
        <h2 className="text-[16px] font-bold">Check in to</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.crews.map((c) => { const on = p.selected.includes(c.id); return <button key={c.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(c.id)}
            className={`flex h-10 max-w-full items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold ${on ? "border-[1.5px] border-[#7C3AED] bg-[#F5F0FF] text-[#6D28D9]" : "border border-[#E7E3DE] bg-[var(--new-white)]"}`}>
            {on && <Check size={16} strokeWidth={2.75} />}{c.emoji && <span aria-hidden>{c.emoji}</span>}<span className="truncate">{c.name}</span></button>; })}
        </div>
        <div className="my-4 h-px bg-[#F0EDE9]" />
        <label className="flex items-center gap-3">
          <span className="flex-1"><span className="block text-[16px] font-bold">Also post to my followers</span>
            <span className="mt-0.5 block text-[13px] text-[var(--new-muted)]">{p.followers ? "On: your crews and your followers see it." : "Off: only your crews see it."}</span></span>
          <Button variant="ghost" role="switch" aria-checked={p.followers} onClick={() => p.onFollowers(!p.followers)} aria-label="Also post to my followers" className={`new-privacy-switch new-checkin-followers ${p.followers ? "on" : ""}`}><span aria-hidden /></Button>
        </label>
      </section>
    </div>
    <div className="z-50 shrink-0 bg-[var(--new-bg)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
      {p.draftRestored && !p.error && <p className="mb-2 text-center text-[13px] text-[var(--new-purple-text)]">Draft restored. Tap the button when you're back online.</p>}
      {p.error && <p role="alert" className="mb-2 text-center text-[14px] text-[var(--new-red)]">{p.error}</p>}
      {!p.selected.length && <p className="mb-2 text-center text-[14px] text-[var(--new-muted)]">Pick at least one crew.</p>}
      {showAlreadyInNote(p.selected, p.crews) && <p className="mb-2 text-center text-[14px] text-[var(--new-muted)]">You're already in today, so this one won't add to your streak.</p>}
      <Button variant="ghost" disabled={!allowed || !p.src} onClick={p.onPost} className="h-[52px] w-full rounded-full bg-[var(--new-purple)] text-[17px] font-bold text-[var(--new-white)] hover:bg-[var(--new-purple)] hover:text-[var(--new-white)] disabled:opacity-50">
        {p.error && !p.posting ? "Try again" : postButtonLabel(p.selected, p.crews, p.posting)}</Button>
      {p.error && !p.posting && <Button variant="ghost" onClick={p.onDraft} disabled={p.savingDraft} className="new-checkin-secondary mt-2.5 h-[52px] w-full rounded-full text-[17px] font-bold">{p.savingDraft ? "Saving..." : "Save as draft"}</Button>}
    </div>
  </div>;
}
