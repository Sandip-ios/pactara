import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNewHomeFeed, getNewHomeSuggestions } from "@/lib/home-feed.functions";
import { getSocialPost } from "@/lib/posts.functions";
import { mergeHomeEntries, type HomeCursor, type HomeTab } from "@/lib/home-feed";
import { consumeHomePosts, subscribeHomePosts } from "@/lib/home-visit-posts";
import { onPostLive } from "@/lib/posting-queue";
import type { SocialPostView } from "@/lib/social-post-types";
import { localDateIn } from "@/lib/streak-rules";
import { SocialPostCard } from "./post/SocialPostCard";
import { RedesignCheckInCard } from "./RedesignCheckInCard";
import { FollowPill } from "./FollowPill";
import { CrewAvatar } from "./CrewAvatars";
import { suggestionDetail } from "@/lib/suggestion-detail";

function EmptyFollowing() {
  const get = useServerFn(getNewHomeSuggestions);
  const suggestions = useQuery({
    queryKey: ["home-suggestions"],
    queryFn: () => get(),
    staleTime: 60_000,
  });
  return (
    <div className="px-5 pb-6 pt-8">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--new-soft)] text-[var(--new-purple)]">
          <Users size={28} />
        </span>
        <h2 className="mt-3 text-[20px] font-extrabold">Nothing here yet</h2>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-[1.45] text-[var(--new-muted)]">
          Follow people and their workouts, meals and plans show up here.
        </p>
      </div>
      {!!suggestions.data?.length && (
        <>
          <h3 className="mt-7 text-[15px] font-extrabold">Suggested for you</h3>
          <ul className="mt-2">
            {suggestions.data.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-3 border-b border-[var(--new-divider)] py-3 last:border-0"
              >
                <Link
                  to="/u/$userId"
                  params={{ userId: person.id }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <CrewAvatar member={person} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{person.name}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-[#57534E]">{suggestionDetail(person.bioLine, person.followers)}</span>
                  </span>
                </Link>
                <FollowPill userId={person.id} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
/** Both new-version Home tabs use the existing cards; cursor and visibility live on the server. */
export function HomeSocialFeed({ tab = "for-you" }: { tab?: HomeTab }) {
  const get = useServerFn(getNewHomeFeed);
  const getPost = useServerFn(getSocialPost);
  const feed = useInfiniteQuery({
    queryKey: ["home-social-posts", tab],
    queryFn: ({ pageParam }) => get({ data: { tab, before: pageParam } }),
    initialPageParam: null as HomeCursor | null,
    getNextPageParam: (last) => last.next,
    staleTime: 30_000,
  });
  const [own, setOwn] = useState<SocialPostView[]>([]);
  const add = useRef(getPost);
  add.current = getPost;
  useEffect(() => {
    let live = true;
    const prepend = async (id: string) => {
      const post = await add.current({ data: { id } });
      if (post?.isMine && live) setOwn((old) => [post, ...old.filter((p) => p.id !== id)]);
    };
    const consume = () => {
      for (const id of consumeHomePosts()) void prepend(id);
    };
    consume();
    const offCreated = subscribeHomePosts(consume);
    const off = onPostLive((id) => {
      void prepend(id);
    });
    // A genuine refresh ends this visit's exception, not switching between tabs.
    const refresh = () => setOwn([]);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      off();
      offCreated();
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "0px 0px 500px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const entries = mergeHomeEntries(
    (feed.data?.pages ?? []).map((p) => p.entries),
    tab === "for-you" ? own : [],
  );
  const viewerToday = localDateIn(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date());
  return (
    <section aria-label={tab === "following" ? "Following feed" : "For you feed"} role="tabpanel">
      {feed.isPending && <FeedLoading />}
      {feed.isError && (
        <div className="p-6 text-center">
          <p className="text-[14px] text-[var(--new-muted)]">Couldn't load posts.</p>
          <Button
            variant="ghost"
            onClick={() => void feed.refetch()}
            className="text-[var(--new-purple)]"
          >
            Try again
          </Button>
        </div>
      )}
      {!feed.isPending &&
        !feed.isError &&
        !entries.length &&
        (tab === "following" ? (
          <EmptyFollowing />
        ) : (
          <p className="px-5 py-12 text-center text-[14px] text-[var(--new-muted)]">
            Nothing new right now. Check back soon.
          </p>
        ))}
      {entries.map((entry) =>
        entry.kind === "post" ? (
          <SocialPostCard
            key={entry.key}
            post={entry.post}
            groupId={entry.post.viewerCrews[0]?.id ?? ""}
            showFollow={tab === "for-you"}
          />
        ) : (
          <RedesignCheckInCard
            key={entry.key}
            item={entry.item}
            checkIn={entry.checkIn}
            viewerToday={viewerToday}
            homeCrewName={entry.crewName}
            showFollow={tab === "for-you"}
            homeFeed
          />
        ),
      )}
      <div ref={sentinel} className="h-px" />
      {isFetchingNextPage && (
        <p className="py-4 text-center text-[13px] text-[var(--new-muted)]">Loading…</p>
      )}
    </section>
  );
}

function FeedLoading() {
  return (
    <div aria-label="Loading posts" role="status">
      {[0, 1].map((i) => (
        <div key={i} className="mx-3 mt-3 rounded-[20px] bg-[var(--new-white)] p-3.5" aria-hidden>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#EFEAE4]" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-[#EFEAE4]" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded-full bg-[#EFEAE4]" />
            </div>
          </div>
          <div className="mt-3 h-[220px] animate-pulse rounded-[14px] bg-[#EFEAE4]" />
        </div>
      ))}
    </div>
  );
}
