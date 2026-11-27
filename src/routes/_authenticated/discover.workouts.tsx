import { Button } from "@/components/ui/button";
import { workoutEmptyLine } from "@/lib/discover-page";
import { createFileRoute, Navigate, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import {
  CardSkeletons,
  FilterPills,
  LoadMore,
  MuscleChips,
  WorkoutCards,
  useDiscoverWorkouts,
} from "@/components/redesign/NewDiscoverWorkouts";
import { DiscoverError, DiscoverListSkeleton } from "@/components/redesign/DiscoverBits";
import { DiscoverWorkoutSheet } from "@/components/redesign/DiscoverWorkoutSheet";
import {
  countLine,
  parseEquipment,
  parseMuscle,
  parseSort,
  parseTime,
  type DiscoverCard,
  type DiscoverQuery,
} from "@/lib/discover-workouts";

type ListSearch = { muscle?: string; equipment?: string; time?: string; sort?: string; q?: string };

export const Route = createFileRoute("/_authenticated/discover/workouts")({
  validateSearch: (s: Record<string, unknown>): ListSearch => {
    const out: ListSearch = {};
    const m = parseMuscle(s.muscle);
    if (m !== "all") out.muscle = m;
    const e = parseEquipment(s.equipment);
    if (e) out.equipment = e;
    const t = parseTime(s.time);
    if (t) out.time = t;
    if (parseSort(s.sort) !== "saved") out.sort = "newest";
    if (typeof s.q === "string" && s.q) out.q = s.q.slice(0, 80);
    return out;
  },
  head: () => ({
    meta: [
      { title: "Workouts · Discover · Pactara" },
      {
        name: "description",
        content: "Browse workouts by muscle, equipment and time. Save one or start it today.",
      },
      { property: "og:title", content: "Workouts · Discover · Pactara" },
      {
        property: "og:description",
        content: "Browse workouts by muscle, equipment and time. Save one or start it today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkoutsListPage,
});

function WorkoutsListPage() {
  const version = useAppVersion();
  const { isLoading } = useAppPrefs();
  if (isLoading) return null;
  if (version !== "new") return <Navigate to="/groups" />;
  return <NewWorkoutsList />;
}

function NewWorkoutsList() {
  useStatusBarScrollToTop();
  const navigate = useNavigate({ from: "/discover/workouts" });
  const router = useRouter();
  const search = Route.useSearch();
  const q: DiscoverQuery = {
    muscle: parseMuscle(search.muscle),
    equipment: parseEquipment(search.equipment),
    time: parseTime(search.time),
    sort: parseSort(search.sort),
    q: search.q ?? "",
  };
  const [text, setText] = useState(q.q);
  const [opened, setOpened] = useState<DiscoverCard | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Arrived by typing on Discover: keep typing here.
  useEffect(() => {
    if (search.q) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== (search.q ?? ""))
        void navigate({ search: (prev) => ({ ...prev, q: text || undefined }), replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [text, search.q, navigate]);
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscoverWorkouts(q, false);
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const open = (c: DiscoverCard) => setOpened(c);
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/groups", search: { tab: "workouts" } });
  };
  return (
    <div
      data-scroll-root
      className="redesign-step3 p5-discover fixed inset-0 w-full overflow-y-auto overscroll-none"
    >
      <div className="bg-white px-4 pb-3 pt-new-top">
        <div className="relative flex h-11 items-center justify-center">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: "#F0EDE8" }}
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="m-0 text-[17px] font-bold">Workouts</h1>
        </div>
        <label
          className="mt-3 flex h-[44px] items-center gap-[10px] rounded-[14px] px-[14px]"
          style={{ background: "#F4F2EF" }}
        >
          <Search size={18} className="shrink-0" style={{ color: "#78716C" }} aria-hidden />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search workouts or exercises"
            aria-label="Search workouts or exercises"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#78716C]"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText("")}
              aria-label="Clear search"
              className="-mr-2 flex h-11 w-11 items-center justify-center"
            >
              <X size={16} style={{ color: "#78716C" }} />
            </button>
          )}
        </label>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-[130px] pt-[14px]">
        <MuscleChips
          value={q.muscle}
          onChange={(m) =>
            void navigate({
              search: (prev) => ({ ...prev, muscle: m === "all" ? undefined : m }),
              replace: true,
            })
          }
        />
        <FilterPills
          value={{ equipment: q.equipment, time: q.time, sort: q.sort }}
          onChange={(f) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                equipment: f.equipment ?? undefined,
                time: f.time ?? undefined,
                sort: f.sort === "saved" ? undefined : f.sort,
              }),
              replace: true,
            })
          }
        />
        <p
          className="m-0 text-[13px]"
          style={{ color: "var(--new-disabled-text)" }}
          aria-live="polite"
        >
          {isLoading ? "\u00a0" : countLine(total, q.muscle)}
        </p>
        {isLoading && <DiscoverListSkeleton />}
        {isError && <DiscoverError kind="workouts" retry={() => void refetch()} />}
        {!isLoading && !isError && items.length === 0 && (
          <div className="p5-error p5-empty">
            <span className="p5-empty-icon p5-soft">
              <Search size={26} />
            </span>
            <h2>No workouts match</h2>
            <p>{workoutEmptyLine(q)}</p>
            <Button
              variant="ghost"
              className="p5-outline"
              onClick={() => {
                setText("");
                void navigate({ search: {}, replace: true });
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        <WorkoutCards cards={items} onOpen={open} />
        {isFetchingNextPage && <CardSkeletons n={2} />}
        <LoadMore
          hasMore={!!hasNextPage}
          loading={isFetchingNextPage}
          onMore={() => void fetchNextPage()}
        />
      </div>
      {opened && <DiscoverWorkoutSheet card={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
