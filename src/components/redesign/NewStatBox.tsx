const MUTED = "#78716C";
const CIRCLE = "#F0EDE8";

/** Shared new-version stat box used by workout and plan headers. */
export function NewStatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-h-[56px] flex-col items-center justify-center gap-[2px] rounded-[12px] py-[10px]" style={{ background: CIRCLE }} data-new-stat-box>
      <span className="text-[20px] font-extrabold leading-[20px]">{value}</span>
      <span className="text-[13px] leading-[14px]" style={{ color: MUTED }}>{label}</span>
    </div>
  );
}
