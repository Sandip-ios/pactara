import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";
const LABEL = "#8A8580";

export type FlashMsg = { kind: "ok" | "err"; text: string } | null;

export function useFlash() {
  const [msg, setMsg] = useState<FlashMsg>(null);
  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    window.setTimeout(() => setMsg(null), 3000);
  };
  return { msg, flash };
}

export function Flash({ msg }: { msg: FlashMsg }) {
  if (!msg) return null;
  return (
    <div
      className={`mb-3 rounded-xl px-4 py-3 text-[14px] font-medium ${
        msg.kind === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {msg.text}
    </div>
  );
}

export function SubPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 w-full overflow-y-auto overscroll-none pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label="Back"
          className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-[18px] font-bold">{title}</div>
      </header>
      <div className="px-5 pt-5">{children}</div>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span
        className="block text-[12px] font-medium mb-1.5"
        style={{ color: LABEL }}
      >
        {label}
      </span>
      {children}
      {error ? (
        <span className="block text-[12px] font-medium mt-1.5 text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span className="block text-[12px] font-medium mt-1.5 text-neutral-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function PrimaryButton({
  disabled,
  loading,
  onClick,
  children,
}: {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full py-3 text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
      style={{ background: PURPLE }}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
