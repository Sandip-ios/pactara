import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The single painted attachment surface shared by compose and edit. */
export function ComposeAttachmentCard({ kind, title, line, action = "Change", onChange, onRemove }: {
  kind: "workout" | "meal"; title: string; line: string; action?: string;
  onChange?: () => void; onRemove?: () => void;
}) {
  return <div data-compose-attachment={kind} className={`flex w-full items-center gap-2.5 rounded-[14px] py-3 pl-3.5 pr-2 ${kind === "workout" ? "bg-[var(--new-post-attachment)]" : "bg-[var(--new-orange-soft)]"}`}>
    <div className="min-w-0 flex-1">{kind === "meal" ? <><div className="text-[11px] font-extrabold tracking-[0.6px] text-[var(--new-orange-icon)]">MEAL</div><div className="text-[16px] font-extrabold">{title}</div><div className="text-[12px] text-[var(--new-muted)]">{line}</div></> : <><div className="text-[11px] font-extrabold tracking-[0.6px] text-[var(--new-purple)]">WORKOUT</div><div className="text-[16px] font-extrabold">{title}</div><div className="text-[12px] text-[var(--new-muted)]">{line}</div></>}</div>
    {onChange && <Button variant="ghost" onClick={onChange} className={kind === "meal" ? "h-8 px-1 text-[13px] font-bold text-[var(--new-orange-icon)] hover:bg-transparent hover:text-[var(--new-orange-icon)]" : "h-8 px-1 text-[13px] font-bold text-[var(--new-purple)] hover:bg-transparent hover:text-[var(--new-purple)]"}>{action}</Button>}
    {onRemove && <Button variant="ghost" aria-label={kind === "meal" ? "Remove attached meal" : `Remove ${title}`} onClick={onRemove} className={kind === "meal" ? "h-8 w-8 shrink-0 px-0 text-[var(--new-post-remove)] hover:bg-transparent hover:text-[var(--new-post-remove)]" : "h-8 w-8 shrink-0 px-0 text-[var(--new-post-remove)] hover:bg-transparent hover:text-[var(--new-post-remove)]"}><X size={16} className={kind === "workout" ? "!size-4" : "!size-4"} /></Button>}
  </div>;
}