import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, ChevronDown, Image, Images, Layers, Play, X, Zap } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatClock, MAX_POST_ITEMS, selectionNumber, toggleSelection } from "@/lib/post-composer";
import { addFiles, defaultEdit, setDraft, usePostDraft } from "@/lib/post-draft";
import { pickFromNativeLibrary } from "@/lib/media-picker";
import { newToast } from "../new-toast";
import { PostTopBar, TextAction, PURPLE, INK, MUTED } from "./PostBits";

const NOTE_KEY = (uid: string) => `pactara:post-library-note:${uid}`;

/** "New post" picker: big preview, Recents, Select multiple, 3-column grid with Camera first. */
export function NewPostPicker() {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const draft = usePostDraft();
  const [multi, setMulti] = useState(draft.selected.length > 1);
  const [current, setCurrent] = useState<string | null>(draft.selected[draft.selected.length - 1] ?? draft.library[0]?.id ?? null);
  const [note, setNote] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUid(id);
      try { if (id && !localStorage.getItem(NOTE_KEY(id))) setNote(true); } catch { /* private mode */ }
    });
  }, []);

  const dismissNote = () => {
    setNote(false);
    try { if (uid) localStorage.setItem(NOTE_KEY(uid), "1"); } catch { /* private mode */ }
  };

  const pick = (id: string) => {
    setCurrent(id);
    setDraft((d) => {
      const selected = multi ? toggleSelection(d.selected, id) : [id];
      const media = d.library.find((m) => m.id === id);
      return { selected, edits: media && !d.edits[id] ? { ...d.edits, [id]: defaultEdit(media) } : d.edits };
    });
  };

  const added = async (files: { blob: Blob; name: string }[]) => {
    const ids = await addFiles(files, (m) => newToast(m));
    if (!ids.length) return;
    setDraft((d) => {
      const lib = d.library;
      const edits = { ...d.edits };
      for (const id of ids) { const m = lib.find((x) => x.id === id); if (m && !edits[id]) edits[id] = defaultEdit(m); }
      const selected = multi || ids.length > 1 ? [...d.selected, ...ids].slice(0, MAX_POST_ITEMS) : [ids[0]!];
      return { selected, edits };
    });
    if (ids.length > 1) setMulti(true);
    setCurrent(ids[0]!);
  };

  const openLibrary = async () => {
    const native = await pickFromNativeLibrary(MAX_POST_ITEMS).catch(() => null);
    if (native) { if (native.length) await added(native); return; }
    libraryInput.current?.click();
  };

  const toggleMulti = () => {
    setMulti((m) => {
      if (m) setDraft((d) => ({ selected: d.selected.slice(-1) }));
      return !m;
    });
  };

  const preview = draft.library.find((m) => m.id === current) ?? null;
  const canNext = draft.selected.length > 0;
  const native = Capacitor.isNativePlatform();
  const pickedMultiple = multi && draft.selected.length > 0;

  return (
    <div className="redesign-step3 fixed inset-0 flex flex-col overflow-hidden bg-white" style={{ color: INK }}>
      <PostTopBar
        title="New post"
        left={<button type="button" aria-label="Close" onClick={() => navigate({ to: "/home" })} className="flex h-11 w-11 items-center justify-center"><X size={24} /></button>}
        right={<TextAction tone="purple" disabled={!canNext} onClick={() => navigate({ to: "/post/edit" })}>Next</TextAction>}
      />
      <div className="relative shrink-0" style={{ height: "min(46vh, 390px)", background: "#0C0A09" }}>
        {preview ? (
          preview.kind === "video" ? (
            <>
              <video key={preview.id} src={preview.url} muted playsInline autoPlay loop className="h-full w-full object-contain" />
              {preview.duration != null && (
                <span className="absolute bottom-3 left-3 flex h-6 items-center gap-1 rounded-[12px] px-2 text-[12px] font-bold text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
                  <Play size={10} fill="currentColor" aria-hidden /> {formatClock(preview.duration)}
                </span>
              )}
            </>
          ) : <img src={preview.url} alt="" className="h-full w-full object-contain" />
        ) : (
          <button type="button" onClick={() => void openLibrary()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-white">
            <Images size={30} aria-hidden />
            <span className="text-[15px] font-bold">Pick a photo or video</span>
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
        <button type="button" onClick={() => void openLibrary()} className="flex h-10 items-center gap-1 text-[16px] font-extrabold">
          Recents <ChevronDown size={18} aria-hidden />
        </button>
        <button
          type="button"
          aria-pressed={multi}
          onClick={toggleMulti}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold"
          style={pickedMultiple ? { background: PURPLE, color: "#FFFFFF", border: `1px solid ${PURPLE}` } : multi ? { background: "var(--new-soft)", color: "var(--new-purple-text)", border: `1px solid ${PURPLE}` } : { background: "var(--new-control)", color: INK, border: "1px solid transparent" }}
        >
          {pickedMultiple ? <Layers size={15} aria-hidden /> : <Image size={15} aria-hidden />} {pickedMultiple ? `${draft.selected.length} selected` : "Select multiple"}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-[2px]">
          <button type="button" aria-label="Camera" onClick={() => cameraInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1.5" style={{ background: "var(--new-control)", color: INK }}>
            <Camera size={26} aria-hidden />
            <span className="text-[13px] font-semibold">Camera</span>
          </button>
          {draft.library.map((m) => {
            const n = selectionNumber(draft.selected, m.id);
            return (
              <button key={m.id} type="button" onClick={() => pick(m.id)} aria-label={`${m.kind === "video" ? "Video" : "Photo"}${n ? `, selected ${n}` : ""}`} className="relative aspect-square overflow-hidden bg-neutral-200">
                {m.kind === "video" ? <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
                {m.kind === "video" && m.duration != null && <span className="absolute bottom-1 right-1.5 text-[12px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">{formatClock(m.duration)}</span>}
                {current === m.id && <span className="absolute inset-0" style={{ background: "rgba(255,255,255,0.35)" }} />}
                <span className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-extrabold text-white shadow-[0_1px_4px_rgba(0,0,0,0.28)]" style={n ? { background: PURPLE, border: "2px solid #FFFFFF" } : { border: "2px solid #FFFFFF", background: "transparent" }}>
                  {n ?? ""}
                </span>
              </button>
            );
          })}
          {!native && <button type="button" aria-label="Open your library" onClick={() => void openLibrary()} className="flex aspect-square flex-col items-center justify-center gap-1.5" style={{ background: "var(--new-control)", color: INK }}>
            <Images size={26} aria-hidden />
            <span className="text-[13px] font-semibold">Library</span>
          </button>}
        </div>
        {multi && <p className="px-4 pt-2 text-[12px]" style={{ color: MUTED }}>Up to {MAX_POST_ITEMS} photos and videos</p>}
      </div>
      {note && (
        <div className="absolute inset-x-3 flex items-start gap-2.5 rounded-[16px] px-3.5 py-3 text-white" style={{ bottom: "calc(16px + env(safe-area-inset-bottom))", background: "#1C1917" }} role="status">
          <Zap size={16} className="mt-0.5 shrink-0 text-[var(--new-library-note-icon)]" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] leading-[1.4]">Posts from your library don't count as check-ins. To check in, use the live camera.</p>
          <button type="button" aria-label="Got it" onClick={dismissNote} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center"><X size={16} /></button>
        </div>
      )}
      <input ref={libraryInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void added(fs.map((f) => ({ blob: f, name: f.name }))); }} />
      <input ref={cameraInput} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; void added(fs.map((f) => ({ blob: f, name: f.name }))); }} />
    </div>
  );
}
