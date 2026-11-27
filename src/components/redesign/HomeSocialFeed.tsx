import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getHomeSocialPosts } from "@/lib/posts.functions";
import { SocialPostCard } from "./post/SocialPostCard";

/** Home: posts you can see under the Today card, same card as the crew feed. Nothing shows when there are none. */
export function HomeSocialFeed() {
  const feed = useInfiniteQuery({
    queryKey: ["home-social-posts"],
    queryFn: ({ pageParam }) => getHomeSocialPosts({ data: { before: pageParam } }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    staleTime: 30_000,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting && !isFetchingNextPage) void fetchNextPage(); }, { rootMargin: "0px 0px 800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const seen = new Set<string>();
  const posts = (feed.data?.pages ?? []).flatMap((p) => p.posts).filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  if (!posts.length) return null;
  return (
    <section aria-label="Posts">
      {posts.map((p) => <SocialPostCard key={p.id} post={p} groupId={p.crewIds[0] ?? ""} />)}
      <div ref={sentinel} className="h-px" />
    </section>
  );
}
