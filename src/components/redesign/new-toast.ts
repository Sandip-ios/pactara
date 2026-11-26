import { toast, type ExternalToast } from "sonner";

/** New-version toasts: same sonner toast, set in Inter like the rest of the new screens. */
export function newToast(message: string, opts: ExternalToast = {}) {
  return toast(message, { ...opts, style: { fontFamily: "Inter, system-ui, sans-serif", ...opts.style } });
}
