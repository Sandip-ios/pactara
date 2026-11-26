import { NewSheet, NewSheetButton } from "./NewSheet";

export function NewCrewConfirm({ open, onOpenChange, title, subtitle, action, busy, error, onConfirm }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; subtitle: string;
  action: string; busy: boolean; error: string | null; onConfirm: () => void;
}) {
  return <NewSheet open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }} title={title} subtitle={subtitle}>
    {error && <p role="alert" className="text-[13px] text-[var(--new-destructive)]">{error}</p>}
    <NewSheetButton disabled={busy} onClick={onConfirm} className="bg-[var(--new-destructive)] hover:bg-[var(--new-destructive)]">{action}</NewSheetButton>
    <NewSheetButton secondary disabled={busy} onClick={() => onOpenChange(false)} className="bg-[var(--new-control)] text-[var(--new-ink)] hover:bg-[var(--new-control)] hover:text-[var(--new-ink)]">Cancel</NewSheetButton>
  </NewSheet>;
}