import { DiscoverMealSearch } from "./DiscoverMeals";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Clock, Lock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchDiscover } from "@/lib/discover-page.functions";
import {
  readRecentSearches,
  recentSearches,
  searchGroups,
  writeRecentSearches,
  type SearchPerson,
  type SearchResults,
} from "@/lib/discover-page";
import { followUser, unfollowUser } from "@/lib/follows.functions";
import type { Plan } from "@/lib/workout-plans";
import type { DiscoverCard } from "@/lib/discover-workouts";
import { DiscoverError, DiscoverImage, DiscoverListSkeleton } from "./DiscoverBits";
import { NewAvatarFallback } from "./NewAvatarFallback";
import { NewSheet, NewSheetRow } from "./NewSheet";
import { newToast } from "./new-toast";
export function DiscoverSearch({
  query,
  onQuery,
  plans,
  onWorkout,
}: {
  query: string;
  onQuery: (q: string) => void;
  plans: Plan[];
  onWorkout: (c: DiscoverCard) => void;
}) {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<string[]>([]);
  const [debounced, setDebounced] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  useEffect(() => {
    try {
      setRecent(readRecentSearches(localStorage));
    } catch {
      setRecent([]);
    }
  }, []);
  const save = () => {
    if (query.trim()) {
      const next = recentSearches(recent, query);
      setRecent(next);
      try {
        writeRecentSearches(localStorage, next);
      } catch {
        /* Disabled phone storage. */
      }
    }
  };
  useEffect(() => {
    window.addEventListener("discover-search-submit", save);
    return () => window.removeEventListener("discover-search-submit", save);
  });
  useEffect(() => {
    setExpanded([]);
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const searchFn = useServerFn(searchDiscover);
  const result = useQuery({
    queryKey: ["discover-search", debounced],
    queryFn: () => searchFn({ data: { q: debounced } }),
    enabled: !!debounced,
    staleTime: 15_000,
    retry: 1,
  });
  const values: SearchResults = {
    people: result.data?.people ?? [],
    workouts: result.data?.workouts ?? [],
    plans: plans.filter((p) => result.data?.planIds.includes(p.id)),
    suggestion: result.data?.suggestion ?? null,
  };
  const groups = searchGroups(values, expanded);
  if (!query.trim())
    return recent.length ? (
      <section className="p5-white">
        <div className="p5-group-heading">
          <h2>RECENT</h2>
          <Button
            variant="ghost"
            className="p5-link"
            onClick={() => {
              setRecent([]);
              try {
                writeRecentSearches(localStorage, []);
              } catch {
                /* Disabled phone storage. */
              }
            }}
          >
            Clear all
          </Button>
        </div>
        {recent.map((text) => (
          <div key={text} className="p5-result">
            <Clock size={18} className="text-[var(--new-disabled-text)]" />
            <Button variant="ghost" className="p5-result-main" onClick={() => onQuery(text)}>
              {text}
            </Button>
            <Button
              variant="ghost"
              className="p5-icon"
              aria-label={`Remove ${text}`}
              onClick={() => {
                const next = recent.filter((r) => r !== text);
                setRecent(next);
                try {
                  writeRecentSearches(localStorage, next);
                } catch {
                  /* Disabled phone storage. */
                }
              }}
            >
              <X />
            </Button>
          </div>
        ))}
      </section>
    ) : (
      <p className="p5-empty text-[14px] text-[var(--new-disabled-text)]">
        Search for a workout, a plan, an exercise, or someone's name.
      </p>
    );
  if (query.trim() !== debounced || result.isPending)
    return (
      <DiscoverListSkeleton n={6} search />
    );
  if (result.isError)
    return (
      <div className="px-4 pt-4">
        <DiscoverError kind="results" retry={() => void result.refetch()} />
      </div>
    );
  if (!groups.length)
    return (
      <>
      <div className="p5-empty">
        <span className="p5-empty-icon">
          <Search size={28} />
        </span>
        <h2>No results for "{query.trim()}"</h2>
        {values.suggestion && (
          <p>
            Did you mean{" "}
            <Button
              variant="ghost"
              className="p5-link h-auto text-[14px]"
              onClick={() => onQuery(values.suggestion ?? "")}
            >
              {values.suggestion}?
            </Button>
          </p>
        )}
        <p>Or try a muscle, a goal like "lose fat", or someone's name.</p>
      </div><DiscoverMealSearch q={debounced} /></>
    );
  return (
    <section className="p5-white">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="p5-group-heading">
            <h2>{group.key.toUpperCase()}</h2>
            {group.seeAll && !expanded.includes(group.key) && (
              <Button
                variant="ghost"
                className="p5-link text-[13px]"
                onClick={() => {
                  save();
                  if (group.key === "workouts")
                    void navigate({ to: "/discover/workouts", search: { q: query.trim() } });
                  else setExpanded((e) => [...e, group.key]);
                }}
              >
                {group.seeAll}
              </Button>
            )}
          </div>
          {group.key === "people"
            ? values.people.slice(0, expanded.includes("people") ? undefined : 3).map((person) => (
                <PeopleResult
                  key={person.id}
                  person={person}
                  onOpen={() => {
                    save();
                    void navigate({ to: "/u/$userId", params: { userId: person.id } });
                  }}
                />
              ))
            : group.key === "workouts"
              ? values.workouts.slice(0, 3).map((c) => (
                  <div key={c.code} className="p5-result">
                    <Button
                      variant="ghost"
                      className="p5-result-main"
                      onClick={() => {
                        save();
                        onWorkout(c);
                      }}
                    >
                      <DiscoverImage
                        url={c.coverUrl}
                        className="h-[52px] w-[52px] rounded-[12px]"
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="line-clamp-2">{c.name}</strong>
                        <small>
                          {c.exercises} {c.exercises === 1 ? "exercise" : "exercises"} · {c.minutes}{" "}
                          min · by {c.author}
                        </small>
                      </span>
                      <ChevronRight />
                    </Button>
                  </div>
                ))
              : values.plans.slice(0, expanded.includes("plans") ? undefined : 3).map((p) => (
                  <div key={p.id} className="p5-result">
                    <Button
                      variant="ghost"
                      className="p5-result-main"
                      onClick={() => {
                        save();
                        void navigate({ to: "/plans/$slug", params: { slug: p.slug } });
                      }}
                    >
                      <DiscoverImage
                        url={p.coverUrl}
                        className="h-[52px] w-[52px] rounded-[12px]"
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="line-clamp-2">{p.name}</strong>
                        <small>
                          {p.weeks} weeks · {p.daysPerWeek} days a week · {p.minutes} min
                        </small>
                      </span>
                      <ChevronRight />
                    </Button>
                  </div>
                ))}
        </div>
      ))}
      <DiscoverMealSearch q={debounced} />
    </section>
  );
}
function PeopleResult({ person, onOpen }: { person: SearchPerson; onOpen: () => void }) {
  const qc = useQueryClient();
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const state =
    person.relationship === "following"
      ? "Following"
      : person.relationship === "requested"
        ? "Requested"
        : "Follow";
  const run = async (remove: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (remove) await unfollow({ data: { target: person.id } });
      else await follow({ data: { target: person.id } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["discover-search"] }),
        qc.invalidateQueries({ queryKey: ["new-member-profile"] }),
        qc.invalidateQueries({ queryKey: ["new-own-profile"] }),
      ]);
      setOpen(false);
    } catch {
      newToast("Couldn't update follow. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const first = person.name.split(" ")[0] ?? person.name;
  return (
    <div className="p5-result">
      <Button variant="ghost" className="p5-result-main" onClick={onOpen}>
        <span className="new-social-avatar h-11 w-11">
          {person.avatar ? <img src={person.avatar} alt="" /> : <NewAvatarFallback />}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-1">
            <span className="truncate">{person.name}</span>
            {person.isPrivate && <Lock size={12} aria-label="Private account" />}
          </strong>
          <small className="line-clamp-2">
            {person.username ? `@${person.username}` : ""}
            {person.username && person.context ? " · " : ""}
            {person.context}
          </small>
        </span>
      </Button>
      {person.isYou ? (
        <span className="text-[12px] text-[var(--new-disabled-text)]">You</span>
      ) : (
        person.canFollow && (
          <Button
            variant="ghost"
            disabled={busy}
            className={`h-[34px] shrink-0 rounded-full px-3 text-[13px] font-bold ${state === "Follow" ? "p5-purple" : "p5-soft"}`}
            onClick={() => {
              if (state === "Follow") void run(false);
              else setOpen(true);
            }}
          >
            {state}
          </Button>
        )
      )}
      <NewSheet
        open={open}
        onOpenChange={setOpen}
        title={state === "Requested" ? "Cancel follow request?" : `Following ${first}`}
        hideTitle={state === "Following" && !person.isPrivate}
        {...(state === "Following" && person.isPrivate
          ? { subtitle: "You'll need to ask again to see their profile." }
          : {})}
      >
        <NewSheetRow
          simple
          title={
            <span className="text-[var(--new-confirm-destructive)]">
              {state === "Requested" ? "Cancel request" : "Unfollow"}
            </span>
          }
          disabled={busy}
          onClick={() => void run(true)}
        />
      </NewSheet>
    </div>
  );
}
