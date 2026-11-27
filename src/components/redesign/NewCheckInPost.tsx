import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNewHomeCheckIn } from "@/lib/home-feed.functions";
import { localDateIn } from "@/lib/streak-rules";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { RedesignCheckInCard } from "./RedesignCheckInCard";
export function NewCheckInPost({ id }: { id: string }) {
  const get = useServerFn(getNewHomeCheckIn);
  const router = useRouter();
  const navigate = useNavigate();
  const scroll = useOpenAtTop();
  useHideBottomTabs(true);
  const post = useQuery({
    queryKey: ["new-checkin-post", id],
    queryFn: () => get({ data: { id } }),
    staleTime: 30_000,
  });
  return (
    <div
      ref={scroll}
      data-scroll-root
      className="redesign-step3 fixed inset-0 overflow-y-auto bg-[var(--new-bg)] pb-[calc(32px+env(safe-area-inset-bottom))]"
    >
      <header className="pt-new-top flex items-center gap-3 bg-[var(--new-white)] px-4 pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="new-profile-menu-button"
          aria-label="Back"
          onClick={() =>
            router.history.canGoBack() ? router.history.back() : void navigate({ to: "/home" })
          }
        >
          <ChevronLeft size={22} />
        </Button>
        <h1 className="text-[17px] font-extrabold">Check-in</h1>
      </header>
      {post.isPending ? (
        <div
          aria-label="Loading check-in"
          className="m-3 h-64 animate-pulse rounded-[20px] bg-[var(--new-white)]"
        />
      ) : post.data?.kind === "checkin" ? (
        <RedesignCheckInCard
          item={post.data.item}
          checkIn={post.data.checkIn}
          viewerToday={localDateIn(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date())}
          homeFeed
        />
      ) : (
        <p className="px-6 py-10 text-center text-[15px] text-[var(--new-muted)]">
          This check-in isn't available.
        </p>
      )}
    </div>
  );
}
