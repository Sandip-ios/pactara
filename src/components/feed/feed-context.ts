import { createContext, useContext } from "react";
import type { FeedMember } from "@/lib/daily-posts.functions";

/** Viewer and crew details the feed cards share (for "You" in cheers, etc.). */
export const FeedContext = createContext<{ me: FeedMember | null; weeklyTarget: number }>({
  me: null,
  weeklyTarget: 5,
});

export const useFeedContext = () => useContext(FeedContext);
