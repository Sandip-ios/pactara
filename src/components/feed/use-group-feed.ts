import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getGroupFeed } from "@/lib/daily-posts.functions";
import { mergeFeedPages } from "@/lib/feed-days";
import { stabilizeSignedUrls } from "@/lib/stable-urls";

/**
 * The group feed, one week per page: today plus the 6 days before it, then 7
 * older days each time the reader nears the bottom. Home and a crew's Activity
 * tab share the ["group-feed", groupId] cache, so both must use this hook.
 */
export function useGroupFeed(groupId: string | null, options?: { staleTime?: number; refetchOnWindowFocus?: boolean }) {
  const query = useInfiniteQuery({
    queryKey: ["group-feed", groupId],
    queryFn: ({ pageParam }) =>
      getGroupFeed({ data: { groupId, before: pageParam } }).then(stabilizeSignedUrls),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    ...options,
  });
  const { fetchNextPage } = query;
  // Never restart a page that is already loading.
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);
  const feed = useMemo(() => (query.data ? mergeFeedPages(query.data.pages) : undefined), [query.data]);
  return {
    feed,
    isPending: query.isPending,
    // A failed "load older days" is shown at the bottom, not as a failed refresh.
    refreshFailed: query.isError && !query.isFetchNextPageError,
    refetch: query.refetch,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMoreFailed: query.isFetchNextPageError,
    loadMore,
  };
}
