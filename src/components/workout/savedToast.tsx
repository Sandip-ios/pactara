import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { newToast, newToastApi } from "@/components/redesign/new-toast";
import type { AppVersion } from "@/lib/app-version";

/** "“Push day” is in My workouts": dark, at the top, so it never covers the buttons. */
export function showSavedToast(name: string, version: AppVersion = "classic") {
  if (version === "new") {
    newToastApi.success(`“${name}” is in My workouts`);
    return;
  }
  toast(`“${name}” is in My workouts`, {
    position: "top-center",
    icon: <CheckCircle2 size={18} style={{ color: "#4ADE80" }} aria-hidden />,
    style: { background: "#141218", color: "#FFFFFF", border: "none", borderRadius: 16, fontSize: 14, fontWeight: 600 },
  });
}

/** Errors for save/share actions, in the same place. */
export function showTopError(message: string, version: AppVersion = "classic") {
  if (version === "new") {
    newToastApi.error(message);
    return;
  }
  showTopMessage(message);
}

/** A short note at the top (e.g. "Link copied" while the Share panel covers the bottom). */
export function showTopMessage(message: string, version: AppVersion = "classic", opts: { success?: boolean } = {}) {
  if (version === "new") {
    newToast(message, opts);
    return;
  }
  toast(message, {
    position: "top-center",
    style: { background: "#141218", color: "#FFFFFF", border: "none", borderRadius: 16, fontSize: 14, fontWeight: 600 },
  });
}
