import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
};

const GROUPS: { name: string; emojis: string[] }[] = [
  {
    name: "Smileys & People",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","💩","🤡","👻","👽","🤖","🙈","🙉","🙊",
    ],
  },
  {
    name: "Gestures & Body",
    emojis: [
      "👍","👎","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤲","🤝","🙏","💪","🦾","🦵","🦶","👂","👀","🧠","🫀",
    ],
  },
  {
    name: "Hearts & Symbols",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💯","🔥","✨","⭐","🌟","💫","⚡","💥","💦","💤","🎉","🎊","🏆","🥇","🎯","✅","❌","⚠️","❓","❗",
    ],
  },
  {
    name: "Activity & Food",
    emojis: [
      "🏃","🚴","🏋️","🧘","🤸","⛹️","🏊","🥊","⚽","🏀","🏈","⚾","🎾","🏐","🥏","🎳","🥅","🚵","🧗","🥗","🍎","🍌","🥑","🥦","🍗","🍕","🍔","🍟","🌮","🍣","🍜","☕","🍵","🥤","💧","🍺","🍷",
    ],
  },
];

const NAMES: Record<string, string> = {};

export default function EmojiPickerSheet({ open, onClose, onSelect }: Props) {
  const [q, setQ] = useState("");
  useHideBottomTabs(open);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      emojis: g.emojis.filter(
        (e) => g.name.toLowerCase().includes(term) || (NAMES[e] ?? "").includes(term),
      ),
    })).filter((g) => g.emojis.length > 0);
  }, [q]);

  if (!open) return null;

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
              placeholder="Search"
              className="flex-1 bg-transparent outline-none text-[15px]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {groups.map((g) => (
            <div key={g.name} className="mb-4">
              <div className="text-[13px] font-bold text-neutral-500 mb-2">{g.name}</div>
              <div className="grid grid-cols-6 gap-1">
                {g.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={`React ${e}`}
                    onClick={() => onSelect(e)}
                    className="h-12 text-[28px] leading-none flex items-center justify-center rounded-xl active:bg-neutral-100"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
