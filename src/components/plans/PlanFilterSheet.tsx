import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import {
  FILTER_DEFS,
  draftCount,
  optionCount,
  showPlansLabel,
  type FilterKey,
  type FilterablePlan,
  type PlanFilters,
} from "@/lib/plan-filters";
import { P } from "./PlanBits";

/** One multi-select filter as a bottom sheet; ticks stay a draft until "Show N plans". */
export function PlanFilterSheet({
  filterKey,
  plans,
  filters,
  onClose,
  onApply,
}: {
  filterKey: FilterKey | null;
  plans: FilterablePlan[];
  filters: PlanFilters;
  onClose: () => void;
  onApply: (key: FilterKey, values: string[]) => void;
}) {
  const [shownKey, setShownKey] = useState<FilterKey>(filterKey ?? "days");
  const [draft, setDraft] = useState<string[]>([]);
  useEffect(() => {
    if (!filterKey) return;
    setShownKey(filterKey);
    setDraft(filters[filterKey]);
    // Reset the draft only when a sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const def = FILTER_DEFS[shownKey];
  const n = draftCount(plans, filters, shownKey, draft);
  const toggle = (v: string) =>
    setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : def.options.map((o) => o.value).filter((o) => o === v || d.includes(o))));

  return (
    <Drawer open={!!filterKey} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent
        className="rounded-t-[24px] border-0 p-0 pb-[max(env(safe-area-inset-bottom),16px)]"
        style={{ background: P.pageBg, fontFamily: "Inter, system-ui, sans-serif", color: P.ink }}
      >
        <div className="flex flex-col gap-3 px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-[20px] font-extrabold tracking-[-0.3px]">{def.title}</DrawerTitle>
            <button
              type="button"
              onClick={() => setDraft([])}
              disabled={draft.length === 0}
              className="-mr-2 flex h-11 shrink-0 items-center px-2 text-[15px] font-bold disabled:opacity-40"
              style={{ color: P.violet }}
            >
              Clear
            </button>
          </div>
          <DrawerDescription className="-mt-2 text-[14px]" style={{ color: P.stone }}>
            {def.helper}
          </DrawerDescription>
          <div className="overflow-hidden rounded-[16px] bg-white" role="group" aria-label={def.chip}>
            {def.options.map((o, i) => {
              const on = draft.includes(o.value);
              const count = optionCount(plans, filters, shownKey, o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(o.value)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
                  style={{ borderTop: i ? "1px solid #F0EDE9" : undefined }}
                >
                  <span
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px]"
                    style={{ background: on ? P.purple : "#FFFFFF", border: on ? "none" : "1.5px solid #D6D3D1" }}
                    aria-hidden
                  >
                    {on && <Check size={15} strokeWidth={3} color="#FFFFFF" />}
                  </span>
                  <span className="min-w-0 flex-1 text-[16px] font-semibold">{o.label}</span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums" style={{ color: P.stone }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={n === 0}
            onClick={() => onApply(shownKey, draft)}
            className="mt-1 h-[52px] w-full rounded-[16px] text-[16px] font-bold disabled:cursor-not-allowed"
            style={n === 0 ? { background: "#E7E3DE", color: "#A8A29E" } : { background: P.purple, color: "#FFFFFF" }}
          >
            {showPlansLabel(n)}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
