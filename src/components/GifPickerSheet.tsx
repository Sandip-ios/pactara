import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { searchGifs } from "@/lib/gifs.functions";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export default function GifPickerSheet({ open, onClose, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  useHideBottomTabs(open);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKeyboardInset(0);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setDebounced("");
    }
  }, [open]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["gifs", debounced],
    queryFn: () => searchGifs({ data: { query: debounced } }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  if (!open) return null;
  const items = data?.items ?? [];

  return (
    <div className="fixed inset-0 z-[95]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-[24px] max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-200"
      >
        <div className="pt-2 flex justify-center shrink-0">
          <div className="h-1.5 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 h-11 rounded-xl bg-neutral-100 px-3">
            <Search size={18} className="text-neutral-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search GIFs"
              autoFocus
              className="flex-1 bg-transparent outline-none text-[15px]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {isError && (
            <div className="py-10 text-center text-[14px] text-neutral-500">
              Couldn't load GIFs. Try again in a moment.
            </div>
          )}
          {!isError && items.length === 0 && isFetching && (
            <div className="py-10 flex justify-center">
              <Loader2 size={22} className="animate-spin text-neutral-400" />
            </div>
          )}
          {!isError && items.length === 0 && !isFetching && (
            <div className="py-10 text-center text-[14px] text-neutral-400">No GIFs found.</div>
          )}
          <div className="columns-2 gap-2 [column-fill:_balance]">
            {items.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelect(g.url)}
                className="mb-2 block w-full overflow-hidden rounded-xl bg-neutral-100 active:opacity-70"
              >
                <img src={g.previewUrl} alt={g.title} loading="lazy" className="w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
