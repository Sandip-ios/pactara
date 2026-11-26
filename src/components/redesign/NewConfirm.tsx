import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function NewConfirm({ open, onOpenChange, title, subtitle, action, cancelLabel = 'Cancel', busy, error, onConfirm, top, note }: {
  top?: ReactNode; note?: string;
  open: boolean; onOpenChange: (open: boolean) => void; title: string; subtitle: string;
  action: string; cancelLabel?: string; busy: boolean; error: string | null; onConfirm: () => void;
}) {
  return <AlertDialog.Root open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="new-confirm fixed inset-0 z-50 bg-[var(--new-sheet-overlay)]" />
      <AlertDialog.Content className="new-confirm fixed left-1/2 top-1/2 z-50 w-[310px] max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-[var(--new-white)] px-5 pt-6 pb-3 text-center text-[var(--new-ink)] outline-none">
        {top && <div className="mb-3 flex justify-center">{top}</div>}
        <AlertDialog.Title className="text-[18px] font-extrabold">{title}</AlertDialog.Title>
        <AlertDialog.Description className={subtitle ? "mt-2 text-[14px] leading-[1.45] text-[var(--new-muted)]" : "sr-only"}>{subtitle || title}</AlertDialog.Description>
        {note && <p className="mt-2 text-[13px] text-[var(--new-disabled-text)]">{note}</p>}
        {error && <p role="alert" className="mt-2 text-[13px] text-[var(--new-destructive)]">{error}</p>}
        <Button variant="ghost" disabled={busy} onClick={onConfirm} className="mt-5 h-12 w-full rounded-[24px] bg-[var(--new-confirm-destructive)] text-[16px] font-bold text-[var(--new-white)] hover:bg-[var(--new-confirm-destructive)] hover:text-[var(--new-white)]">{action}</Button>
        <AlertDialog.Cancel asChild>
          <Button variant="ghost" disabled={busy} className="h-12 w-full bg-transparent text-[16px] font-bold text-[var(--new-ink)] hover:bg-transparent hover:text-[var(--new-ink)]">{cancelLabel}</Button>
        </AlertDialog.Cancel>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}