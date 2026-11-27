import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Crop, Image as ImageIcon, Plus, Scissors, Volume2, VolumeX } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { itemsStripLabel, moveItem, trimLabel, type DraftItem } from "@/lib/post-composer";
import { pickedItems, setDraft, usePostDraft } from "@/lib/post-draft";
import { PostTopBar, TextAction } from "./PostBits";

type Tool = "trim" | "cover" | "crop";
const YELLOW = "#FACC15";

/** Dark Edit screen: trim, cover, sound and 4:5 crop for videos; crop only for photos. */
export function NewPostEdit() {
  useHideBottomTabs(true);
  const navigate = useNavigate();
  const draft = usePostDraft();
  const picked = pickedItems(draft);
  const [activeId, setActiveId] = useState(picked[0]?.media.id ?? null);
  const active = picked.find((p) => p.media.id === activeId) ?? picked[0] ?? null;
  const [tool, setTool] = useState<Tool>(active?.media.kind === "video" ? "trim" : "crop");
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (!picked.length) void navigate({ to: "/post/new", replace: true }); }, [picked.length, navigate]);
  useEffect(() => { if (active?.media.kind === "photo" && tool !== "crop") setTool("crop"); }, [active?.media.kind, tool]);

  if (!active) return null;
  const edit = active.edit;
  const update = (patch: Partial<DraftItem>) => setDraft((d) => ({ edits: { ...d.edits, [active.media.id]: { ...edit, ...patch } } }));
  const isVideo = active.media.kind === "video";
  const dur = active.media.duration ?? 0;
  const pos = `50% ${Math.round(edit.crop.y * 100)}%`;

  return (
    <div className="redesign-step3 fixed inset-0 flex flex-col overflow-hidden text-white" style={{ background: "#0C0A09" }}>
      <PostTopBar dark title="Edit" left={<TextAction dark onClick={() => navigate({ to: "/post/new" })}>Back</TextAction>} right={<TextAction dark tone="purple" onClick={() => navigate({ to: "/post/compose" })}>Next</TextAction>} />
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="relative w-full overflow-hidden rounded-[14px]" style={{ aspectRatio: edit.crop.aspect === "4:5" ? "4 / 5" : undefined, maxHeight: "100%", height: edit.crop.aspect === "4:5" ? undefined : "100%" }}>
          {isVideo ? (
            <video
              key={active.media.id}
              ref={video}
              src={active.media.url}
              muted={edit.muted}
              playsInline
              autoPlay
              onTimeUpdate={(e) => { const v = e.currentTarget; const end = edit.trimEnd ?? dur; if (end && v.currentTime >= end) v.currentTime = edit.trimStart; }}
              className="h-full w-full"
              style={{ objectFit: edit.crop.aspect === "4:5" ? "cover" : "contain", objectPosition: pos }}
            />
          ) : (
            <img src={active.media.url} alt="" className="h-full w-full" style={{ objectFit: edit.crop.aspect === "4:5" ? "cover" : "contain", objectPosition: pos }} />
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3">
        {isVideo && tool === "trim" && (
          <div>
            <TrimBar duration={dur} start={edit.trimStart} end={edit.trimEnd ?? dur} onChange={(s, e) => { update({ trimStart: s, trimEnd: e }); if (video.current) video.current.currentTime = s; }} />
            <p className="pt-2 text-center text-[13px] font-semibold" style={{ color: "#D6D3D1" }}>{trimLabel(edit)}</p>
          </div>
        )}
        {isVideo && tool === "cover" && (
          <label className="block">
            <span className="text-[13px] font-semibold" style={{ color: "#D6D3D1" }}>Pick the frame people see first</span>
            <input type="range" min={0} max={Math.max(0.1, dur)} step={0.1} value={edit.cover} aria-label="Cover frame"
              onChange={(e) => { const t = Number(e.target.value); update({ cover: t }); if (video.current) { video.current.pause(); video.current.currentTime = t; } }}
              className="mt-2 w-full accent-[#FACC15]" />
          </label>
        )}
        {tool === "crop" && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => update({ crop: { ...edit.crop, aspect: edit.crop.aspect === "4:5" ? "original" : "4:5" } })} className="h-9 shrink-0 rounded-full px-3.5 text-[14px] font-bold" style={{ background: "#292524" }}>
              {edit.crop.aspect === "4:5" ? "4:5" : "Original"}
            </button>
            {edit.crop.aspect === "4:5" && (
              <input type="range" min={0} max={1} step={0.01} value={edit.crop.y} aria-label="Crop position" onChange={(e) => update({ crop: { ...edit.crop, y: Number(e.target.value) } })} className="min-w-0 flex-1 accent-[#FACC15]" />
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 justify-around px-4 pt-3">
        {isVideo && <ToolButton label="Trim" active={tool === "trim"} onClick={() => setTool("trim")}><Scissors size={20} /></ToolButton>}
        {isVideo && <ToolButton label="Cover" active={tool === "cover"} onClick={() => setTool("cover")}><ImageIcon size={20} /></ToolButton>}
        {isVideo && <ToolButton label={edit.muted ? "Sound off" : "Sound"} active={edit.muted} onClick={() => update({ muted: !edit.muted })}>{edit.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</ToolButton>}
        <ToolButton label="4:5 crop" active={tool === "crop"} onClick={() => setTool("crop")}><Crop size={20} /></ToolButton>
      </div>

      <ReorderStrip items={picked.map((p) => ({ id: p.media.id, url: p.media.url, kind: p.media.kind }))} activeId={active.media.id} onSelect={(id) => setActiveId(id)} onAdd={() => navigate({ to: "/post/new" })} />
    </div>
  );
}

function ToolButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="flex min-w-[64px] flex-col items-center gap-1 py-1 text-[12px] font-semibold" style={{ color: active ? YELLOW : "#E7E5E4" }}>
      {children}
      {label}
    </button>
  );
}

function TrimBar({ duration, start, end, onChange }: { duration: number; start: number; end: number; onChange: (s: number, e: number) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = (which: "s" | "e") => (ev: React.PointerEvent) => {
    ev.preventDefault();
    const el = bar.current;
    if (!el || !duration) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
      if (which === "s") onChange(Math.min(t, end - 1), end);
      else onChange(start, Math.max(t, start + 1));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const l = duration ? (start / duration) * 100 : 0;
  const r = duration ? (end / duration) * 100 : 100;
  return (
    <div ref={bar} className="relative h-12 rounded-[10px]" style={{ background: "#292524" }} aria-label="Trim">
      <div className="absolute inset-y-0 rounded-[8px]" style={{ left: `${l}%`, right: `${100 - r}%`, borderTop: `3px solid ${YELLOW}`, borderBottom: `3px solid ${YELLOW}`, background: "rgba(250,204,21,0.12)" }} />
      <button type="button" aria-label="Trim start" onPointerDown={drag("s")} className="absolute inset-y-0 w-4 -translate-x-full touch-none rounded-l-[8px]" style={{ left: `${l}%`, background: YELLOW }} />
      <button type="button" aria-label="Trim end" onPointerDown={drag("e")} className="absolute inset-y-0 w-4 touch-none rounded-r-[8px]" style={{ left: `${r}%`, background: YELLOW }} />
    </div>
  );
}

/** "3 items · hold and drag to reorder": long-press a thumb, then slide it. */
function ReorderStrip({ items, activeId, onSelect, onAdd }: { items: { id: string; url: string; kind: "photo" | "video" }[]; activeId: string; onSelect: (id: string) => void; onAdd: () => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const THUMB = 64;
  const start = (id: string) => (ev: React.PointerEvent) => {
    const x0 = ev.clientX;
    let from = items.findIndex((i) => i.id === id);
    let armed = false;
    timer.current = window.setTimeout(() => { armed = true; setDragging(id); }, 300);
    const move = (e: PointerEvent) => {
      if (!armed) return;
      const to = Math.max(0, Math.min(items.length - 1, from + Math.round((e.clientX - x0) / (THUMB + 8))));
      if (to !== from) {
        setDraft((d) => ({ selected: moveItem(d.selected, from, to) }));
        from = to;
      }
    };
    const up = () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (!armed) onSelect(id);
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="shrink-0 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
      <p className="pb-2 text-[13px] font-semibold" style={{ color: "#D6D3D1" }}>{itemsStripLabel(items.length)}</p>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {items.map((it, i) => (
          <button key={it.id} type="button" onPointerDown={start(it.id)} aria-label={`Item ${i + 1}`} className="relative shrink-0 touch-none overflow-hidden rounded-[10px]"
            style={{ width: THUMB, height: THUMB, outline: it.id === activeId ? "2px solid #FFFFFF" : "none", transform: dragging === it.id ? "scale(1.08)" : undefined, opacity: dragging && dragging !== it.id ? 0.7 : 1 }}>
            {it.kind === "video" ? <video src={`${it.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={it.url} alt="" className="h-full w-full object-cover" />}
            <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "#7C3AED" }}>{i + 1}</span>
          </button>
        ))}
        {items.length < 10 && (
          <button type="button" aria-label="Add more" onClick={onAdd} className="flex shrink-0 items-center justify-center rounded-[10px]" style={{ width: THUMB, height: THUMB, border: "2px dashed #57534E", color: "#D6D3D1" }}>
            <Plus size={22} />
          </button>
        )}
      </div>
    </div>
  );
}
