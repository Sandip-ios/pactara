import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { PlansDiscover } from "@/components/plans/PlansDiscover";
import { FILTER_KEYS, cleanFilter, type FilterKey, type PlanFilters } from "@/lib/plan-filters";

type DiscoverSearch = {
  invite?: string;
  tab?: "plans" | "crews";
  complete?: string;
} & Partial<Record<FilterKey, string>>;

const listParam = (v: unknown) => (typeof v === "number" ? String(v) : typeof v === "string" && v ? v : undefined);

/**
 * Discover = workout plans only. Crews live on Home ("Your crews"); old
 * /groups?tab=crews and /groups?invite=<id> links open Home with the crew
 * sheet (or that crew's invite) instead.
 */
export const Route = createFileRoute("/_authenticated/groups/")({
  // Filters live in the URL (comma lists) so coming back from a plan keeps them.
  validateSearch: (s: Record<string, unknown>): DiscoverSearch => ({
    invite: typeof s.invite === "string" && s.invite ? s.invite : undefined,
    tab: s.tab === "crews" || s.tab === "plans" ? s.tab : undefined,
    complete: typeof s.complete === "string" && s.complete ? s.complete : undefined,
    days: listParam(s.days),
    minutes: listParam(s.minutes),
    equipment: listParam(s.equipment),
    level: listParam(s.level),
    goal: listParam(s.goal),
  }),
  beforeLoad: ({ search }) => {
    if (search.invite) throw redirect({ href: `/home?invite=${encodeURIComponent(search.invite)}`, replace: true });
    if (search.tab === "crews") throw redirect({ href: "/home?crews=1", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Discover · Pactara" },
      { name: "description", content: "Find a workout plan on Pactara: browse by goal, filter by days, time and equipment, or search." },
    ],
  }),
  component: DiscoverPage,
});

const D_INK = "#141218";
const DISCOVER_TOP = "max(56px, calc(env(safe-area-inset-top) + 12px))";

function DiscoverPage() {
  useStatusBarScrollToTop();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const completeSlug = search.complete;
  const [query, setQuery] = useState("");
  const filters = useMemo(() => {
    const f = {} as PlanFilters;
    for (const k of FILTER_KEYS) f[k] = cleanFilter(k, (search[k] ?? "").split(","));
    return f;
  }, [search]);
  const setFilters = (f: PlanFilters) =>
    navigate({
      to: "/groups",
      search: (prev) => {
        const next = { ...prev };
        for (const k of FILTER_KEYS) next[k] = f[k].length ? f[k].join(",") : undefined;
        return next;
      },
      replace: true,
      resetScroll: false,
    });

  return (
    <div
      data-scroll-root
      className="fixed inset-0 w-full overflow-y-auto overscroll-none"
      style={{ background: "#F4F2EF", fontFamily: "Inter, system-ui, sans-serif", color: D_INK }}
    >
      <div className="flex flex-col gap-[18px] px-4 pb-[130px]" style={{ paddingTop: DISCOVER_TOP }}>
        <h1 className="mx-1 text-[30px] font-extrabold tracking-[-0.6px]" style={{ color: D_INK }}>
          Discover
        </h1>
        <label
          className="flex h-[50px] items-center gap-[10px] rounded-[25px] bg-white px-[14px]"
          style={{ border: "1.5px solid #E7E3DE" }}
        >
          <Search size={20} className="shrink-0" style={{ color: "#78716C" }} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'Try "no equipment" or "glutes"'}
            aria-label="Search plans"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#A8A29E]"
            style={{ color: D_INK }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <X size={16} style={{ color: "#78716C" }} />
            </button>
          )}
        </label>
        <PlansDiscover
          query={query}
          onClearQuery={() => setQuery("")}
          filters={filters}
          onFiltersChange={setFilters}
          completeSlug={completeSlug}
          onCloseComplete={() =>
            navigate({ to: "/groups", search: (prev) => ({ ...prev, complete: undefined }), replace: true })
          }
        />
      </div>
    </div>
  );
}
