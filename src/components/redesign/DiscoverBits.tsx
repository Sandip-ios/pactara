import { useState } from "react";
import { ChevronLeft, Dumbbell } from "lucide-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { coverThumb } from "@/lib/plan-filters";
import "./discover-page.css";
export function DiscoverImage({ url, className = "" }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = coverThumb(url, 780);
  return (
    <span className={`p5-image ${className}`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <Dumbbell className="size-7!" aria-hidden />
      )}
    </span>
  );
}
export function DiscoverError({
  kind,
  retry,
}: {
  kind: "plans" | "workouts" | "results";
  retry: () => void;
}) {
  return (
    <div className="p5-error" role="alert">
      <strong>Couldn't load {kind}</strong>
      <p>Check your connection and try again.</p>
      <Button variant="ghost" className="p5-outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
export function DiscoverListSkeleton({ n = 5 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading">
      <>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="p5-skeleton h-[90px] animate-pulse" />
        ))}
      </>
    </div>
  );
}
export function DiscoverHeader({ title }: { title: string }) {
  const router = useRouter();
  const navigate = useNavigate();
  return (
    <div className="p5-white px-4 pb-3 pt-new-top">
      <div className="relative flex h-11 items-center justify-center">
        <Button
          variant="ghost"
          aria-label="Back"
          className="p5-icon absolute left-0 bg-[var(--new-control)]!"
          onClick={() => {
            if (window.history.length > 1) router.history.back();
            else void navigate({ to: "/groups" });
          }}
        >
          <ChevronLeft className="size-6!" />
        </Button>
        <h1 className="text-[17px] font-bold">{title}</h1>
      </div>
    </div>
  );
}
