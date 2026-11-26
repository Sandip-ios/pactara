import { toast, type ExternalToast } from "sonner";
import { Check } from "lucide-react";

type NewToastOpts = Pick<ExternalToast, "id"> & {
  /** Green check circle in front of the message. */
  success?: boolean;
  /** Shows a right-aligned "Undo"; the toast then stays 5s instead of 3s. */
  undo?: () => void;
  /** Back-compat with sonner's action option ({ label, onClick }). */
  action?: { label: string; onClick: () => void };
};

/** New-version toast duration: about 3s, 5s when it can be undone. */
export function newToastDuration(hasUndo: boolean): number {
  return hasUndo ? 5000 : 3000;
}

/**
 * New-version toast: near-black card in the rest-bar family. Sonner still
 * handles stacking, slide-in, swipe to dismiss and the bottom offset
 * (`--toast-bottom`, see src/lib/toast-offset.ts). Classic keeps plain toasts.
 */
export function newToast(message: string, opts: NewToastOpts = {}) {
  const undo = opts.undo ?? opts.action?.onClick;
  const undoLabel = opts.action?.label ?? "Undo";
  return toast.custom(
    (id) => (
      <div
        role="status"
        onClick={() => toast.dismiss(id)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-4 py-[14px]"
        style={{ background: "#1C1917", boxShadow: "0 8px 24px rgba(20,18,24,0.25)", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {opts.success && (
          <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: "#22C55E" }}>
            <Check size={13} strokeWidth={3.5} color="#FFFFFF" />
          </span>
        )}
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-[1.3] text-white">{message}</span>
        {undo && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toast.dismiss(id); undo(); }}
            className="-my-2 -mr-1 h-10 shrink-0 px-1 text-[14px] font-extrabold"
            style={{ color: "#C4B5FD" }}
          >
            {undoLabel}
          </button>
        )}
      </div>
    ),
    {
      ...(opts.id != null ? { id: opts.id } : {}),
      duration: newToastDuration(!!undo),
      unstyled: true,
      style: { background: "transparent", border: "none", boxShadow: "none", padding: 0 },
    },
  );
}

/** Drop-in for sonner's `toast` in new-version screens: success gets the green check. */
export const newToastApi = Object.assign((message: string, opts?: NewToastOpts) => newToast(message, opts), {
  success: (message: string, opts?: NewToastOpts) => newToast(message, { ...opts, success: true }),
  error: (message: string, opts?: NewToastOpts) => newToast(message, opts),
  info: (message: string, opts?: NewToastOpts) => newToast(message, opts),
});
