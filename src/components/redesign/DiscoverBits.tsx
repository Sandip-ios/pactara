import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { FlatDumbbell } from "./NewProfileParts";
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
        <FlatDumbbell size={28} />
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
    <div className="p5-error p5-error-row" role="alert">
      <div className="min-w-0 flex-1">
        <strong>Couldn't load {kind}</strong>
        <p>Check your connection and try again.</p>
      </div>
      <Button variant="ghost" className="p5-outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
export function DiscoverListSkeleton({ n = 5, search = false }: { n?: number; search?: boolean }) {
  return (
    <div className={search ? "p5-white" : "flex flex-col gap-[10px]"} aria-label="Loading">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className={search ? "p5-result animate-pulse" : "p5-white flex items-center gap-3 rounded-[16px] px-3 py-[10px] animate-pulse"}>
            <span className={`p5-skeleton rounded-[12px] ${search ? "size-11" : "size-16"}`} />
            <span className="min-w-0 flex-1 flex flex-col gap-[7px]">
              <span className="p5-skeleton h-[13px] w-3/5 rounded-full" />
              <span className="p5-skeleton h-[10px] w-4/5 rounded-full" />
              {!search && <span className="p5-skeleton h-[10px] w-[45%] rounded-full" />}
            </span>
          </div>
        ))}
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
