import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The single painted attachment surface shared by compose and edit. */
export function ComposeAttachmentCard({ kind, title, line, action = "Change", onChange, onRemove }: {
  kind: "workout" | "meal"; title: string; line: string; action?: string;
  onChange: () => void; onRemove: () => void;
}) {
  return <div data-compose-attachment={kind} className={`flex w-full items-center gap-2.5 rounded-[14px] py-3 pl-3.5 pr-2 ${kind === "workout" ? "bg-[var(--new-post-attachment)]" : "bg-[var(--new-orange-soft)]"}`}>
    <div className="min-w-0 flex-1"><div className={`text-[11px] font-extrabold tracking-[0.6px] ${kind === "workout" ? "text-[var(--new-purple)]" : "text-[var(--new-orange-icon)]"}`}>{kind.toUpperCase()}</div><div className="text-[16px] font-extrabold">{title}</div><div className="text-[12px] text-[var(--new-muted)]">{line}</div></div>
    <Button variant="ghost" onClick={onChange} className={`h-8 shrink-0 px-1 text-[13px] font-bold hover:bg-transparent ${kind === "workout" ? "text-[var(--new-purple)] hover:text-[var(--new-purple)]" : "text-[var(--new-orange-icon)] hover:text-[var(--new-orange-icon)]"}`}>{action}</Button>
    <Button variant="ghost" aria-label={`Remove attached ${kind}`} onClick={onRemove} className="h-8 w-8 shrink-0 px-0 text-[var(--new-post-remove)] hover:bg-transparent hover:text-[var(--new-post-remove)]"><X className="!size-4" /></Button>
  </div>;
}